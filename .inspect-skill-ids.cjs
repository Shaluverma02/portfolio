const { MongoClient } = require('mongodb');

async function inspect() {
    const uri = process.env.MONGODB_URI;
    if (!uri) throw new Error('MONGODB_URI is not configured.');
    const client = new MongoClient(uri, { serverSelectionTimeoutMS: 8000 });
    try {
        await client.connect();
        const collection = client.db(process.env.MONGODB_DB || 'portfolio').collection('skills');
        const docs = await collection.find({}).project({ name: 1, id: 1, _id: 1 }).limit(10).toArray();
        console.log(JSON.stringify(docs.map(doc => ({
            name: doc.name,
            idType: typeof doc.id,
            idPresent: doc.id !== undefined && doc.id !== null && String(doc.id).trim() !== '',
            mongoIdType: doc._id?.constructor?.name,
            mongoId: String(doc._id)
        })), null, 2));
    } finally {
        await client.close();
    }
}

inspect().catch(error => {
    console.error(`Could not inspect skill IDs (${error.code || error.cause?.code || error.name}).`);
    process.exitCode = 1;
});
