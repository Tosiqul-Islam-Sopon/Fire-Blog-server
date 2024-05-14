const express = require('express');
const cors = require('cors');
const jwt = require('jsonwebtoken');
const cookieParser = require('cookie-parser');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

const app = express();
const port = process.env.PORT || 5000;

app.use(cors({
    origin: ['http://localhost:5173'],
    credentials: true
}));
app.use(express.json());
app.use(cookieParser());

const verifyToken = (req, res, next) => {
    const token = req.cookies.accessToken;
    if (!token) {
        return res.status(401).send({ message: 'Unauthorized access' });
    }
    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ message: 'Unauthorized access' });
        }
        req.user = decoded;
        next();
    });
};

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.nnvexxr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        await client.connect();
        const database = client.db("FireBlogDB");
        const blogCollection = database.collection("Blogs");
        const commentCollection = database.collection("Comments");
        const wishlistCollection = database.collection("Wishlists");
        const trendCollection = database.collection("TechTrends");
        const questionCollection = database.collection("Questions");
        const replyCollection = database.collection("Replies");

        app.post("/jwt", async (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.cookie('accessToken', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production',
                sameSite: process.env.NODE_ENV === 'production' ? 'none' : 'lax'
            }).send({ success: true });
        });

        app.post("/logout", (req, res) => {
            res.clearCookie('accessToken')
                .send({ success: true });
        });

        app.get("/latestBlogs", async (req, res) => {
            const result = await blogCollection.find().sort({ uploadDateTime: -1 }).limit(6).toArray();
            res.send(result);
        });

        app.get("/blog/:id", async (req, res) => {
            const id = req.params.id;
            const result = await blogCollection.findOne({ _id: new ObjectId(id) });
            res.send(result);
        });

        app.get("/allBlogs", async (req, res) => {
            const { title, category } = req.query;
            let query = {};

            if (title && category) {
                query = {
                    $and: [
                        { title: { $regex: title, $options: 'i' } },
                        { category }
                    ]
                };
            } else if (title) {
                query = { title: { $regex: title, $options: 'i' } };
            } else if (category) {
                query = { category };
            }

            const result = await blogCollection.find(query).toArray();
            res.send(result);
        });

        app.post("/addBlog", verifyToken, async (req, res) => {
            const blog = req.body;
            if (blog?.uploaderEmail !== req?.user.email){
                return res.status(403).send({message: 'forbidden access'})
            }
            const result = await blogCollection.insertOne(blog);
            res.send(result);
        });

        app.patch("/updateBlog/:id", verifyToken, async (req, res) => {
            const blogId = req.params.id;
            const updatedBlog = req.body;
            if (updatedBlog?.uploaderEmail !== req?.user.email){
                return res.status(403).send({message: 'forbidden access'})
            }
            const query = { _id: new ObjectId(blogId) };
            const update = { $set: updatedBlog };
            const result = await blogCollection.updateOne(query, update);
            res.send(result);
        });

        app.get("/comments/:id", async (req, res) => {
            const id = req.params.id;
            const query = { blogId: id };
            const result = await commentCollection.find(query).toArray();
            res.send(result);
        });

        app.post("/addComment", async (req, res) => {
            const comment = req.body;
            const result = await commentCollection.insertOne(comment);
            res.send(result);
        });

        app.get("/wishlists/:email", verifyToken, async (req, res) => {
            const email = req.params.email;
            if (email !== req.user.email){
                return res.status(403).send({message: 'forbidden access'})
            }
            const query = { wishlistUserEmail: email };
            const result = await wishlistCollection.find(query).toArray();
            res.send(result);
        });

        app.post("/addWishlist", verifyToken, async (req, res) => {
            const wishlist = req.body;
            if (wishlist?.wishlistUserEmail !== req?.user.email){
                return res.status(403).send({message: 'forbidden access'})
            }
            const blogId = wishlist.blogId;
            const existingBlog = await wishlistCollection.findOne({ blogId });

            if (existingBlog) {
                return res.status(400).json({ error: "This blog is already in your wishlist." });
            }

            const result = await wishlistCollection.insertOne(wishlist);
            res.send(result);
        });

        app.delete("/wishlist/:id", verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await wishlistCollection.deleteOne(query);
            res.send(result);
        });

        app.get("/techTrends", async (req, res) => {
            const result = await trendCollection.find().toArray();
            res.send(result);
        });

        app.get("/questions", async (req, res) => {
            const questions = await questionCollection.find().sort({ createdAt: -1 }).limit(5).toArray();
            res.send(questions);
        });

        app.get("/question/:id", async (req, res) => {
            const id = req.params.id;
            const result = await questionCollection.findOne({ _id: new ObjectId(id) });
            res.send(result);
        });

        app.post("/askQuestion", verifyToken, async (req, res) => {
            const question = req.body;
            if (question?.userEmail !== req?.user.email){
                return res.status(403).send({message: 'forbidden access'})
            }
            const result = await questionCollection.insertOne(question);
            res.send(result);
        });

        app.patch("/likeQuestion/:id", verifyToken, async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const update = { $inc: { likes: 1 } };
            const result = await questionCollection.updateOne(query, update);
            res.send(result);
        });

        app.get('/replies/:id', async (req, res) => {
            const id = req.params.id;
            const query = { questionId: id };
            const result = await replyCollection.find(query).toArray();
            res.send(result);
        });

        app.post('/replies', verifyToken, async (req, res) => {
            const reply = req.body;
            if (reply?.userEmail !== req?.user.email){
                return res.status(403).send({message: 'forbidden access'})
            }
            const result = await replyCollection.insertOne(reply);
            res.send(result);
        });

        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Optionally close the client when you're done
        // await client.close();
    }
}

run().catch(console.dir);

app.get("/", (req, res) => {
    res.send("FireBlog server is Running");
});

app.listen(port, () => {
    console.log(`FireBlog server is running on ${port}`);
});
