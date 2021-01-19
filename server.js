var express = require("express");
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var cors = require("cors");
var morgan = require("morgan");
var path = require("path")
var jwt = require('jsonwebtoken')
var { userModel, tweetModel } = require('./dbconn/modules');
var app = express();
var authRoutes = require('./routes/auth')
var SERVER_SECRET = process.env.SECRET || "1234";
var http = require("http");
var socketIO = require("socket.io");
var server = http.createServer(app);
var io = socketIO(server);
var multer = require('multer')
const fs = require('fs')
var upload = multer({ dest: './uploads/' })
var admin = require("firebase-admin");
io.on("connection", () => {
    console.log("chl gya");
})

app.use(bodyParser.json());
app.use(cookieParser());

app.use(cors({
    origin: '*',
    credentials: true
}));

app.use(morgan('dev'));
app.use("/", express.static(path.resolve(path.join(__dirname, "public"))))

app.use('/', authRoutes);
app.use(function (req, res, next) {
    if (!req.cookies.jToken) {
        res.status(401).send("include http-only credentials with every request")
        return;
    }
    jwt.verify(req.cookies.jToken, SERVER_SECRET, function (err, decodedData) {
        if (!err) {

            const issueDate = decodedData.iat * 1000;
            const nowDate = new Date().getTime();
            const diff = nowDate - issueDate;

            if (diff > 300000) {
                res.status(401).send("token expired")
            } else {
                var token = jwt.sign({
                    id: decodedData.id,
                    name: decodedData.name,
                    email: decodedData.email,
                }, SERVER_SECRET)
                res.cookie('jToken', token, {
                    maxAge: 86400000,
                    httpOnly: true
                });
                req.body.jToken = decodedData
                next();
            }
        } else {
            res.status(401).send("invalid token")
        }
    });
})

app.get("/profile", (req, res, next) => {

    console.log(req.body)

    userModel.findById(req.body.jToken.id, 'name email phone gender createdOn',
        function (err, doc) {
            if (!err) {
                res.send({
                    status: 200,
                    profile: doc
                })

            } else {
                res.status(500).send({
                    message: "server error"
                })
            }
        })
})

app.post('/tweet', (req, res, next) => {
    if (!req.body.userName && !req.body.tweet) {
        res.status(403).send({
            message: "please provide email or tweet"
        })
    }
    console.log(req.body.userName)
    // userTweets.push(req.body.tweet)
    // userNames.push(req.body.userName)
    var newTweet = new tweetModel({
        "name": req.body.userName,
        "tweets": req.body.tweet
    })
    newTweet.save((err, data) => {
        if (!err) {
            res.send({
                status: 200,
                message: "Post created",
                data: data
            })
            console.log(data.tweets)
            io.emit("NEW_POST", data)
        } else {
            console.log(err);
            res.status(500).send({
                message: "user create error, " + err
            })
        }
    });
})

app.get('/getTweets', (req, res, next) => {

    tweetModel.find({}, (err, data) => {
        if (err) {
            console.log(err)
        }
        else {
            console.log(data)
            // data = data[data.length -1]
            res.send(data)
        }
    })
})

app.post("/upload", upload.any(), (req, res, next) => {

    console.log("req.body: ", req.body);
    console.log("req.body: ", JSON.parse(req.body.myDetails));
    console.log("req.files: ", req.files);

    console.log("uploaded file name: ", req.files[0].originalname);
    console.log("file type: ", req.files[0].mimetype);
    console.log("file name in server folders: ", req.files[0].filename);
    console.log("file path in server folders: ", req.files[0].path);
    try {
        fs.unlinkSync(req.files[0].path)
        //file removed
    } catch (err) {
        console.error(err)
    }
    res.send({
        // file: req.files,
        message: "Ok"
    });
    var admin = require("firebase-admin");

    // Fetch the service account key JSON file contents
    var serviceAccount = require("path/to/\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC/epAJmFORF3eI\nr9NGxpQOQphn3M/a+Enpo+zZPhlHbSUVhqkurfHPJnFRcGMS5ZPyC7p2fqfVWx3b\nAUo8BGM2sBIfQ8Kk6143593ZzLbFu/NLY0n5wYrkIBdvf8JYiPRnx2O/NCnCFcWu\ndRLGj+ZYfio0LO/p+zxQJYwJSo9+qaU+2Iww1krmdx2qdsGHgpZes4GGUy8EoPbF\nuCqw8l6VwlgHoOFA6+j5v9+aU33aqIDzfPdJqekzhub2S9pBk4zBtPBoY+1L/Bm2\nlQlauiAtYEw5tFQGsYtCvJIYvNli+ZBSICdkaTIz23InNWpu+UJUZYLUaQu9K94C\n9Rl8gpmlAgMBAAECggEANb9Vhxv2+Rc5OmkASTGchZQz65OT1Mc1GBwnc6N2vRHq\nAuzVuICjC56i2FVPuhIvQRYBtRlASydUbhEioU4p+0PZEmWW0Wwv+klfgK9x7ncf\nh93K+gxVzEslyOp3xxpKYIcbfKRLxGsQHjRGnO3vno9rkVG71lXrTCP99u2y8b53\nlr43cRNqZvJ9JIvSSaFEHpf1leLG7CCYpotWbIy/aQO4eByTkpiePL+CN56WKloE\nUhtR6QSNpJrdIIZalZDJsdxOU3pMjFNNaDIehbAMTZwtSlOijSlxeNwzkZeoi886\nF1YXRLO1BOftu25aIo6GmihRj4Kqpg/uici/WDBCUQKBgQD7LjUV2O+6QRpmK6YI\nKgSCPUwu3itUtR4jDL1We+uFGtZ4vrJj7sIvLmZ7IhokC7SIrvBVMNP5PV2kNKXK\ngCQGSwi1zbPjeH36NYrUec8G84B4zcj2Fc8fxqEMEvPYH1FgazMwiohv1BJVLHfB\nuU0+xtFp4CH2v/zI3t2N/PH0LwKBgQDDJxoNbRGoDDeko3wTL+jfwJoykY0KB7X4\nwFPg2DC1qdvDu8CgZqUQ8hE11cjUFvrkARbY6++eAfR3iODa/KvR6E+2WVQ/ZPIM\nMg8RM1JFvAK+H3q+8+PxGkg3SdFTJ2H3z/1LFoK35pdeSFXvR4DNYddmRjZaR+e2\nbqLpnRKWawKBgQC/XEezOlAA/SJonm5in+hJdPu6ZSZr5YRtPYJuBgC7qmOlH9t2\niOrF2TrYKnXx6j0DOQv+SzHjG55gwH9ilFdduAKNx4Z6EU0gt3PqRla0PAUvg8/L\ns3fWBJSjRzkg+VMc+u7H13L0h4PkAfnGzC6OWhgm6kvV2hRy0F/IkeGfnwKBgAR0\naAvWaYjEfqCrerGVbmNtKhftaqLH+kdrXH7NcI81CWc2afc/YJU6cVohPyxYOfHq\ndHMPL7ETqljwLvHQwrtP6kHnWBz6WOweWGm0GjStTgK5BTxGpPVj/DIG5VhYlcvq\nW4XTRbic8uecDxofL7mAekJDaAo3ifqIG//pLftxAoGAaURiGsxdY5FgoNYI6CZK\nQnkVhoO5+n0IMx818t6Com3tn0m2M2U9UGVt3mDvU7HG6ayjmR24syd0+VIUCeRR\nomANfLrBArhLV554Ic34MMOqrMg2k1ig5DR8RQ/ulYzp06iMV1bwe81AUN8+eTas\nu9PotZm23u/zQYIdlMb4mtM=\n.json");

    // Initialize the app with a service account, granting admin privileges
    admin.initializeApp({
        credential: admin.credential.cert('firebase-adminsdk-nrq5c@twitter-profile-pics.iam.gserviceaccount.com'),
        databaseURL: "https://databaseName.firebaseio.com"
    });

    // As an admin, the app has access to read and write all data, regardless of Security Rules
    var db = admin.database();
    var ref = db.ref("restricted_access/secret_document");
    ref.once("value", function (snapshot) {
        console.log(snapshot.val());
    });
})
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
    console.log("server is running on: ", PORT);
})
