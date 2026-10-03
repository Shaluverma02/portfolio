const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const { collections, validateContent } = require('./content-store');

async function readLegacyList(dataDir, name) {
    try {
        const data = JSON.parse(await fs.readFile(path.join(dataDir, `${name}.json`), 'utf8'));
        if (!Array.isArray(data) || data.some(item => !item || typeof item !== 'object' || Array.isArray(item))) {
            throw new Error(`Invalid ${name}.json: expected a list of records.`);
        }
        return data;
    } catch (error) {
        if (error.code === 'ENOENT') return [];
        throw error;
    }
}

function publicRecord(record) {
    const { _id, _order, ...item } = record;
    return item;
}

async function createMongoStore({ dataDir, env }) {
    const { MongoClient } = require('mongodb');
    const uri = env.MONGODB_URI || 'mongodb://127.0.0.1:27017';
    const databaseName = (env.MONGODB_DB || 'portfolio').trim();
    if (!databaseName) throw new Error('MONGODB_DB must not be empty.');

    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 5000 });
    try {
        await client.connect();
        const database = client.db(databaseName);
        const migrations = database.collection('portfolio_migrations');

        async function migrateCollection(name) {
            const migrationId = `json-import:${name}`;
            if (await migrations.findOne({ _id: migrationId })) return;

            const target = database.collection(name);
            const existingCount = await target.countDocuments();
            const records = existingCount ? [] : await readLegacyList(dataDir, name);
            const used = new Set();
            const documents = records.map((record, index) => {
                let id = record.id;
                if (typeof id !== 'string' || !/^[a-zA-Z0-9_-]{1,100}$/.test(id) || used.has(id)) {
                    id = crypto.randomUUID();
                }
                used.add(id);
                const fields = { ...record };
                delete fields.id;
                delete fields._id;
                delete fields._order;
                return { ...fields, _id: id, _order: records.length - index };
            });
            if (documents.length) {
                await target.bulkWrite(documents.map(document => ({
                    replaceOne: { filter: { _id: document._id }, replacement: document, upsert: true }
                })), { ordered: true });
            }
            await database.collection('portfolio_sequences').updateOne(
                { _id: name },
                { $max: { value: Math.max(records.length, existingCount) } },
                { upsert: true }
            );
            await migrations.insertOne({ _id: migrationId, completedAt: new Date() });
        }

        for (const collection of collections) await migrateCollection(collection);
        await migrateCollection('contacts');

        async function read(collection) {
            if (!collections.includes(collection)) {
                throw Object.assign(new Error('Content section not found.'), { status: 404 });
            }
            const records = await database.collection(collection).find({}, { projection: { _order: 0 } })
                .sort({ _order: -1, _id: 1 }).toArray();
            return records.map(publicRecord);
        }

        async function mutate(collection, operation, id, body) {
            if (!collections.includes(collection)) {
                throw Object.assign(new Error('Content section not found.'), { status: 404 });
            }
            const target = database.collection(collection);
            if (operation === 'add') {
                const value = validateContent(collection, body);
                const sequence = await database.collection('portfolio_sequences').findOneAndUpdate(
                    { _id: collection },
                    { $inc: { value: 1 } },
                    { upsert: true, returnDocument: 'after', includeResultMetadata: false }
                );
                const item = { id: crypto.randomUUID(), ...value };
                await target.insertOne({ _id: item.id, _order: sequence.value, ...value });
                return { item, items: await read(collection) };
            }

            const existing = await target.findOne({ _id: id });
            if (!existing) {
                throw Object.assign(new Error('This item no longer exists. Refresh the dashboard.'), { status: 404 });
            }
            if (operation === 'delete') {
                await target.deleteOne({ _id: id });
                return { items: await read(collection) };
            }
            const value = validateContent(collection, body);
            await target.replaceOne({ _id: id }, { _id: id, _order: existing._order, ...value });
            const item = { id, ...value };
            return { item, items: await read(collection) };
        }

        async function readContacts() {
            return database.collection('contacts').find({}, { projection: { _id: 0, _order: 0 } })
                .sort({ timestamp: 1, _id: 1 }).toArray();
        }

        async function addContact(entry) {
            await database.collection('contacts').insertOne(entry);
        }

        return {
            read,
            mutate,
            readContacts,
            addContact,
            close: () => client.close()
        };
    } catch (error) {
        await client.close();
        throw error;
    }
}

module.exports = { createMongoStore };
