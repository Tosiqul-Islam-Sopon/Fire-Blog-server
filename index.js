const express = require('express');
const cors = require('cors');
require('dotenv').config();
const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
    origin: true,
    credentials: true
}));
app.use(express.json());



const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nnvexxr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const database = client.db("FireBlogDB");
        const blogCollection = database.collection("Blogs");
        const commentCollection = database.collection("Comments");
        const wishlistCollection = database.collection("Wishlists");

        app.get("/latestBlogs", async (req, res) => {
            const result = await blogCollection.find()
                .sort({ uploadDateTime: -1 })
                .limit(6)
                .toArray();
            res.send(result);
        });

        app.get("/blog/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await blogCollection.findOne(query);
            res.send(result);
        })

        app.get("/allBlogs", async (req, res) => {
            const title = req.query.title;
            const category = req.query.category;

            let query = {};

            if (title && category) {
                query = {
                    $and: [
                        { title: { $regex: title, $options: 'i' } },
                        { category: category }
                    ]
                };
            }
            else if (title) {
                query = { title: { $regex: title, $options: 'i' } };
            }
            else if (category) {
                query = { category: category };
            }

            const result = await blogCollection.find(query).toArray();
            res.json(result);
        })

        app.post("/addBlog", async (req, res) => {
            const blog = req.body;
            const result = await blogCollection.insertOne(blog);
            res.send(result);
        })

        app.patch("/updateBlog/:id", async (req, res) => {
            const blogId = req.params.id;
            const updatedBlog = req.body;

            const query = { _id: new ObjectId(blogId) };
            const update = { $set: updatedBlog };

            const result = await blogCollection.updateOne(query, update);
            res.send(result);
        })


        app.get("/comments/:id", async (req, res) => {
            const id = req.params.id;
            const query = { blogId: { $eq: id } };
            const result = await commentCollection.find(query).toArray();
            res.send(result);
        })

        app.post("/addCommet", async (req, res) => {
            const commant = req.body;
            const result = await commentCollection.insertOne(commant);
            res.send(result);
        })



        app.get("/wishlists/:email", async (req, res) => {
            const email = req.params.email;
            const query = { wishlistUserEmail: { $eq: email } }
            const result = await wishlistCollection.find(query).toArray();
            res.send(result);
        })

        app.post("/addWishlist", async (req, res) => {
            const wishlist = req.body;
            const blogId = wishlist.blogId;

            const existingBlog = await wishlistCollection.findOne({ blogId: blogId });

            if (existingBlog) {
                return res.status(400).json({ error: "This blog is already in your wishlist." });
            }

            const result = await wishlistCollection.insertOne(wishlist);
            res.json(result);
        });

        app.delete("/wishlist/:id", async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await wishlistCollection.deleteOne(query);
            res.send(result);
        })

        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
        // await client.close();
    }
}
run().catch(console.dir);



app.get("/", (req, res) => {
    res.send("FireBlog server is Running");
})

app.listen(port, () => {
    console.log(`FireBlog server is running on ${port}`);
})