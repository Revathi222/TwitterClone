const express = require("express");
const app = express();
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const path = require("path");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

app.use(express.json());

let dbPath = path.join(__dirname, "twitterClone.db");

let db = null;
const initializeDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server running at 3000 Port");
    });
  } catch (error) {
    console.log(`${error.message}`);
  }
};

initializeDbAndServer();
//API - 1
//Register an User
app.post("/register/", async (request, response) => {
  const userDetails = request.body;
  const { username, password, name, gender } = userDetails;
  const getUserQuery = `SELECT * FROM user where username='${username}';`;
  const dbUser = await db.get(getUserQuery);
  if (dbUser === undefined) {
    if (password.length < 6) {
      response.status = 400;
      response.send("Password is too short");
    } else {
      const hashedPassword = await bcrypt.hash(password, 10);
      const registerUser = `INSERT INTO user(name,username,password,gender)
        VALUES('${name}','${username}','${hashedPassword}','${gender}');`;
      const nweUser = await db.run(registerUser);
      response.status = 200;
      response.send("user registered successfully");
    }
  } else {
    response.status = 400;
    response.send("User already exists");
  }
});

//API - 2
//login and generate access token with JWT
app.post("/login/", async (request, response) => {
  const { username, password } = request.body;
  const getUserQuery = `SELECT * FROM user 
    where username='${username}';`;
  const dbUser = await db.get(getUserQuery);
  if (dbUser !== undefined) {
    const machedPassword = await bcrypt.compare(password, dbUser.password);
    if (machedPassword) {
      const payload = {
        username: username,
      };
      const accessToken = await jwt.sign(payload, "revathi_dev");
      response.send({ jwtToken: accessToken });
    } else {
      response.status = 400;
      response.send("Invalid User");
    }
  } else {
    response.status = 400;
    response.send("Invalid User");
  }
});

//Authentication with JWT Token(middleware function)
const authenticateToken = async (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
    jwt.verify(jwtToken, "revathi_dev", async (error, payload) => {
      if (error) {
        console.log(error);
        response.status = 400;
        response.send("Invalid Access Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  } else {
    response.status = 400;
    response.send("Invalid Access Token");
  }
};

const dbObjectToObject = (eachTweet) => {
  return {
    username: eachTweet.username,
    tweetId: eachTweet.tweet_id,
    tweet: eachTweet.tweet,
    dateTime: eachTweet.date_time,
  };
};
//API - 3
// 4 latest tweets of people
app.get("/user/tweets/feed/", authenticateToken, async (request, response) => {
  const { username } = request;
  const { order, order_by, limit } = request.query;
  const getTweet = ` select uf.username,t.tweet_id,t.tweet,t.date_time  from user u join follower f on u.user_id=f.follower_user_id join user uf on uf.user_id=f.following_user_id join tweet t  on t.user_id=f.following_user_id where u.username='${username}' ORDER BY ${order_by} ${order}   LIMIT ${limit};`;
  const feedArray = await db.all(getTweet);
  response.send(feedArray.map((eachTweet) => dbObjectToObject(eachTweet)));
});

//API - 4
//list of all names of people whom the user follows
app.get("/user/following/", authenticateToken, async (request, response) => {
  const { username } = request;
  const userFollowingQuery = `select uf.username from user u join follower fl on u.user_id=fl.follower_user_id join user uf on uf.user_id=fl.following_user_id where u.username='${username}';`;
  console.log(userFollowingQuery);
  const userFollowingList = await db.all(userFollowingQuery);
  response.send(userFollowingList);
});

//API - 5
//list of all names of people who follows the user
app.get("/user/followers/", authenticateToken, async (request, response) => {
  const { username } = request;
  const userFollowingQuery = `select uf.username  from user u join follower f on u.user_id =f.following_user_id  join user uf on uf.user_id =f.follower_user_id  where u.user_id=2 ;`;
  console.log(userFollowingQuery);
  const userFollowingList = await db.all(userFollowingQuery);
  response.send(userFollowingList);
});

//API - 6
//get Tweets of user following
app.get("/tweets/:tweetId/", authenticateToken, async (request, response) => {
  const { tweetId } = request.params;
  const { username } = request;
  const tweetsUserFollowingQuery = `select t.tweet,(
       SELECT COUNT(like_id)
       FROM like
       WHERE tweet_id=t.tweet_id
   ) AS likes,
   (
       SELECT COUNT(reply_id)
       FROM reply
       WHERE tweet_id=t.tweet_id
   ) AS replies,t.date_time from 
  user u join follower f on u.user_id=f.follower_user_id join user uf 
  on uf.user_id=f.following_user_id join tweet t  on t.user_id=f.following_user_id 
  where t.tweet_id=${tweetId}  and t.user_id=uf.user_id and u.username='${username}' ;`;
  console.log(tweetsUserFollowingQuery);
  const tweetsUserFollowing = await db.all(tweetsUserFollowingQuery);

  if (tweetsUserFollowing.length === 0) {
    response.status = 401;
    response.send("Invalid request");
  } else {
    response.send(tweetsUserFollowing);
  }
});

//API -7
//
app.get(
  "/tweets/:tweetId/likes/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    const { username } = request;
    const tweetsUserFollowingQuery = `select ul.username from user u join follower f on u.user_id=f.follower_user_id join user uf 
   on uf.user_id=f.following_user_id join tweet t  on t.user_id=f.following_user_id join "like" l on l.tweet_id=t.tweet_id
    join user ul on ul.user_id=l.user_id  where t.tweet_id=${tweetId}  and t.user_id=uf.user_id and u.username='${username}' ;
   ;`;
    const usernameOfLikedTweetList = await db.all(tweetsUserFollowingQuery);
    if (usernameOfLikedTweetList.length === 0) {
      response.status = 401;
      response.send("Invalid request");
    } else {
      response.send(usernameOfLikedTweetList);
    }
  }
);

//API - 8
// Create a tweet in tweet table
app.post("/user/tweets/", authenticateToken, async (request, response) => {
  const { username } = request;
  const { tweet } = request.body;
  const currentDate = new Date();
  const getUserIdQuery = `SELECT user_id FROM user WHERE username='${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  const addTweetQuery = `INSERT INTO tweet(tweet,user_id,date_time)
    VALUES('${tweet}',${getUserId.user_id},'${currentDate}');`;
  const addTweet = await db.run(addTweetQuery);
  response.send("Tweet Created");
});

//API-9
//Delete tweet
app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;

    const { username } = request;
    const getUserIdQuery = `SELECT user_id FROM user WHERE username='${username}';`;
    const getUserId = await db.get(getUserIdQuery);
    const getTweetQuery = `SELECT * FROM tweet WHERE tweet_id=${tweetId} and user_id=${getUserId.user_id};`;
    const getTweet = await db.get(getTweetQuery);
    if (getTweet === undefined) {
      response.status = 401;
      response.send("Invalid Request");
    } else {
      const deleteTweetQuery = `DELETE FROM tweet WHERE tweet_id=${tweetId} and user_id=${getUserId.user_id};`;
      const deleteTweet = await db.run(deleteTweetQuery);
      response.send("Tweet Deleted successfully");
    }
  }
);
module.exports=app;
