import express from "express";
import { MongoClient } from "mongodb";
import { v4 as uuid } from "uuid";
import sign from "jwt-encode";
import dotenv from "dotenv";

const app = express();
const port = 8000;

dotenv.config({ path: "./.env" });

// Database Name
const dbName = "play";

// collections
const videosCollection = "videos";
const usersCollection = "users";
const categoriesCollection = "categories";

// Connection URL
const url = `mongodb+srv://${process.env.MONGO_DB_USERNAME}:${process.env.MONGO_DB_USER_PASSWORD}@${process.env.MONGO_DB_CLUSTER_URL}/${dbName}?retryWrites=true&w=majority`;

// middlleware
// to parse response body
app.use(express.urlencoded({ extended: true }));
app.use(express.json());

let client;
let allVideos = [];

const createEncodedToken = (data) => {
  return sign(data, process.env.JWT_SECRET_KEY);
};

const connectDatabase = async (res) => {
  try {
    client = await MongoClient.connect(url);
    const db = client.db();
    return db;
  } catch (error) {
    res.status(500).json({ message: "Connecting to database failed" });
    return;
  }
};

app.get("/api/videos", async (req, res) => {
  try {
    const db = await connectDatabase(res);
    const videos = await db.collection(videosCollection).find().toArray();
    allVideos = videos;
    res.send(videos).status(200);
    client.close();
  } catch (error) {
    res
      .status(500)
      .json({ message: "Unable to get videos, please try later!" });
  }
});

// to get single video
app.get("/api/video/:videoId", async (req, res) => {
  const videoId = req.params.videoId;
  try {
    const db = await connectDatabase(res);
    const videos =
      allVideos.length === 0
        ? (await db.collection(videosCollection).find({}).toArray()).find(
            (video) => video._id === videoId
          )
        : allVideos;

    if (videos._id === videoId) res.send(videos).status(200);
    else res.sendStatus(404);
    client.close();
  } catch (error) {
    res.status(500).json({ message: "Unable to get video, please try later!" });
  }
});

// like
//get all liked videos
app.get("/api/user/likes", async (req, res) => {
  const headerToken = req.headers.authorization;
  const db = await connectDatabase(res);

  try {
    const userDetails = await db
      .collection(usersCollection)
      .findOne({}, { token: headerToken });

    if (userDetails.token === headerToken) {
      res.send(userDetails.likes);
      client.close();
    } else {
      res.status(403).json({ message: "Unathorized access" });
      client.close();
      return;
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Unable to like this video, please try later!" });
  }
});

//like video
app.post("/api/user/like/:videoId", async (req, res) => {
  const headerToken = req.headers.authorization;
  const videoId = req.params.videoId;

  const db = await connectDatabase(res);

  try {
    const selectedVideo =
      allVideos.length > 0
        ? allVideos.filter((video) => video._id === videoId)
        : (await db.collection(videosCollection).find({}).toArray()).find(
            (video) => video._id === videoId
          );

    if (selectedVideo._id === videoId) {
      const userDetails = await db
        .collection(usersCollection)
        .findOne({}, { token: headerToken });

      if (userDetails.token === headerToken) {
        // to check if already liked
        const isAvailable = userDetails.likes.some(
          (video) => video._id === videoId
        );

        if (isAvailable) {
          res.status(200).json({ message: "Already liked" });
          client.close();
          return;
        } else {
          const filter = { token: headerToken };
          const options = { upsert: true };
          const updateDoc = {
            $set: { likes: userDetails.likes.concat(selectedVideo) },
          };
          // to update array
          await db
            .collection(usersCollection)
            .updateOne(filter, updateDoc, options);
          res.status(200).json({ message: "Video liked" });
          client.close();
        }
      } else {
        res.status(403).json({ message: "Unathorized access" });
        client.close();
        return;
      }
    } else {
      res.status(404).json({ message: "Video not found" });
      client.close();
      return;
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Unable to like this video, please try later!" });
  }
});

//remove liked video
app.delete("/api/user/like/:videoId", async (req, res) => {
  const headerToken = req.headers.authorization;
  const videoId = req.params.videoId;

  const db = await connectDatabase(res);

  try {
    const userDetails = await db
      .collection(usersCollection)
      .findOne({}, { token: headerToken });

    if (userDetails.token === headerToken) {
      const remainingVideos = userDetails.likes.filter(
        (video) => video._id !== videoId
      );

      const filter = { token: headerToken };
      const options = { upsert: true };
      const updateDoc = {
        $set: { likes: remainingVideos },
      };

      // to update array
      await db
        .collection(usersCollection)
        .updateOne(filter, updateDoc, options);

      res.status(200).json({ message: "Video removed from like" });
      client.close();
    } else {
      res.status(403).json({ message: "Unathorized access" });
      client.close();
      return;
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Unable to like this video, please try later!" });
  }
});

// playlist
// get all playlists
app.get("/api/user/playlists", async (req, res) => {
  const headerToken = req.headers.authorization;
  const db = await connectDatabase(res);

  try {
    const userDetails = await db
      .collection(usersCollection)
      .findOne({}, { token: headerToken });

    if (userDetails.token === headerToken) {
      res.send(userDetails.playlists);
      client.close();
    } else {
      res.status(403).json({ message: "Unathorized access" });
      client.close();
      return;
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Unable to get playlists, please try later!" });
  }
});

// get single playlist
app.get("/api/user/playlist/:playlistId", async (req, res) => {
  const headerToken = req.headers.authorization;
  const playlistId = req.params.playlistId;

  const db = await connectDatabase(res);

  try {
    const userDetails = await db
      .collection(usersCollection)
      .findOne({}, { token: headerToken });

    if (userDetails.token === headerToken) {
      const selectedPlaylist = userDetails.playlists.filter(
        (playlist) => playlist.id === playlistId
      );

      if (selectedPlaylist) {
        res.send(selectedPlaylist);
        client.close();
      } else {
        res.status(404).json({ message: "Playlist not found" });
        client.close();
        return;
      }
    } else {
      res.status(403).json({ message: "Unathorized access" });
      client.close();
      return;
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Unable to get playlists, please try later!" });
  }
});

// create playlist
app.post("/api/user/playlist", async (req, res) => {
  const headerToken = req.headers.authorization;
  const playlistName = req.body.name;

  const db = await connectDatabase(res);

  const newPlaylist = { id: uuid(), name: playlistName, videos: [] };

  if (!playlistName) {
    res.status(400).json({ message: "Playlist name cannot be blank" });
    client.close();
    return;
  }

  try {
    const userDetails = await db
      .collection(usersCollection)
      .findOne({}, { token: headerToken });

    if (userDetails.token === headerToken) {
      // to get create new playlist
      const updatedPlaylists = [newPlaylist, ...userDetails.playlists];

      const filter = { token: headerToken };
      const options = { upsert: true };
      const updateDoc = {
        $set: { playlists: updatedPlaylists },
      };

      // to update array
      await db
        .collection(usersCollection)
        .updateOne(filter, updateDoc, options);

      res.status(201).json({ message: "Playlist created", data: newPlaylist });
      client.close();
    } else {
      res.status(403).json({ message: "Unathorized access" });
      client.close();
      return;
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Unable to create playlists, please try later!" });
  }
});

// add video to playlist
app.post("/api/user/playlist/:playlistId/video/:videoId", async (req, res) => {
  const headerToken = req.headers.authorization;
  const playlistId = req.params.playlistId;
  const videoId = req.params.videoId;

  const db = await connectDatabase(res);

  try {
    const userDetails = await db
      .collection(usersCollection)
      .findOne({}, { token: headerToken });

    if (userDetails.token === headerToken) {
      // to get one playlist
      const selectedPlaylist = userDetails.playlists.find(
        (playlist) => playlist.id === playlistId
      );

      if (selectedPlaylist) {
        // to check if video is present in selected playlist
        const isVideoAvailable = selectedPlaylist.videos.some(
          (video) => video._id === videoId
        );
        if (!isVideoAvailable) {
          // add new video to previous video list
          const selectedVideo =
            allVideos.length > 0
              ? allVideos.filter((video) => video._id === videoId)
              : (await db.collection(videosCollection).find({}).toArray()).find(
                  (video) => video._id === videoId
                );

          if (!selectedVideo) {
            res.status(404).json({ message: "Video not found" });
            client.close();
            return;
          }
          const updatedPlaylistVideos = [
            selectedVideo,
            ...selectedPlaylist.videos,
          ];

          // to filter remaining playlist other than selected
          const remainingPlaylists = userDetails.playlists.filter(
            (playlist) => playlist.id !== selectedPlaylist.id
          );

          // to update playlists
          const updatedPlaylists = [
            { ...selectedPlaylist, videos: updatedPlaylistVideos },
            ...remainingPlaylists,
          ];

          const filter = { token: headerToken };
          const options = { upsert: true };
          const updateDoc = {
            $set: { playlists: updatedPlaylists },
          };

          // to update array
          await db
            .collection(usersCollection)
            .updateOne(filter, updateDoc, options);

          res.send({ ...selectedPlaylist, videos: updatedPlaylistVideos });
          client.close();
        } else {
          res
            .status(409)
            .json({ message: "Video is already added in your playlist" });
          client.close();
          return;
        }
      } else {
        res.status(404).json({ message: "Playlist not found" });
        client.close();
        return;
      }
    } else {
      res.status(403).json({ message: "Unathorized access" });
      client.close();
      return;
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Unable to update playlists, please try later!" });
  }
});

// remove single video from playlist
app.delete(
  "/api/user/playlist/:playlistId/video/:videoId",
  async (req, res) => {
    const headerToken = req.headers.authorization;
    const playlistId = req.params.playlistId;
    const videoId = req.params.videoId;

    const db = await connectDatabase(res);

    try {
      const userDetails = await db
        .collection(usersCollection)
        .findOne({}, { token: headerToken });

      if (userDetails.token === headerToken) {
        // to get one playlist
        const selectedPlaylist = userDetails.playlists.find(
          (playlist) => playlist.id === playlistId
        );

        if (selectedPlaylist) {
          // to check if video is present in selected playlist
          const isVideoAvailable = selectedPlaylist.videos.some(
            (video) => video._id === videoId
          );
          if (isVideoAvailable) {
            // to filter remaining videos
            const remainingPlaylistVideos = selectedPlaylist.videos.filter(
              (video) => video._id !== videoId
            );

            // to filter remaining playlist other than selected
            const remainingPlaylists = userDetails.playlists.filter(
              (playlist) => playlist.id !== selectedPlaylist.id
            );

            // to update playlists
            const updatedPlaylists = [
              { ...selectedPlaylist, videos: remainingPlaylistVideos },
              ...remainingPlaylists,
            ];

            const filter = { token: headerToken };
            const options = { upsert: true };
            const updateDoc = {
              $set: { playlists: updatedPlaylists },
            };

            // to update array
            await db
              .collection(usersCollection)
              .updateOne(filter, updateDoc, options);

            res.status(200).json({
              message: "Video removed from playlist",
              data: selectedPlaylist,
            });
            client.close();
          } else {
            res.status(404).json({ message: "Video not found" });
            client.close();
            return;
          }
        } else {
          res.status(404).json({ message: "Playlist not found" });
          client.close();
          return;
        }
      } else {
        res.status(403).json({ message: "Unathorized access" });
        client.close();
        return;
      }
    } catch (error) {
      res
        .status(500)
        .json({ message: "Unable to get playlists, please try later!" });
    }
  }
);

// delete playlist
app.delete("/api/user/playlist/:id", async (req, res) => {
  const headerToken = req.headers.authorization;
  const playlistId = req.params.id;

  const db = await connectDatabase(res);

  try {
    const userDetails = await db
      .collection(usersCollection)
      .findOne({}, { token: headerToken });

    if (userDetails.token === headerToken) {
      const isAvailable = userDetails.playlists.some(
        (playlist) => playlist.id === playlistId
      );
      if (isAvailable) {
        const remainingPlaylists = userDetails.playlists.filter(
          (playlist) => playlist.id !== playlistId
        );
        const filter = { token: headerToken };
        const options = { upsert: true };
        const updateDoc = {
          $set: { playlists: remainingPlaylists },
        };

        // to update array
        await db
          .collection(usersCollection)
          .updateOne(filter, updateDoc, options);

        res.status(200).json({ message: "Playlist deleted" });
        client.close();
      } else {
        res.status(404).json({ message: "Playlist not found" });
      }
    } else {
      res.status(403).json({ message: "Unathorized access" });
      client.close();
      return;
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Unable to delete playlists, please try later!" });
  }
});

// to test from
// watchlater
// get all watchlater
app.get("/api/user/watchlater", async (req, res) => {
  const headerToken = req.headers.authorization;
  const db = await connectDatabase(res);

  try {
    const userDetails = await db
      .collection(usersCollection)
      .findOne({}, { token: headerToken });

    if (userDetails.token === headerToken) {
      res.send(userDetails.watchlater);
      client.close();
    } else {
      res.status(403).json({ message: "Unathorized access" });
      client.close();
      return;
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Unable to get watchlater, please try later!" });
  }
});

// add to watchlater
app.post("/api/user/watchlater/:videoId", async (req, res) => {
  const headerToken = req.headers.authorization;
  const videoId = req.params.videoId;

  const db = await connectDatabase(res);

  try {
    const userDetails = await db
      .collection(usersCollection)
      .findOne({}, { token: headerToken });

    if (userDetails.token === headerToken) {
      const selectedVideo =
        allVideos.length > 0
          ? allVideos.filter((video) => video._id === videoId)
          : (await db.collection(videosCollection).find({}).toArray()).find(
              (video) => video._id === videoId
            );

      const filter = { token: headerToken };
      const options = { upsert: true };
      const updateDoc = {
        $set: { watchlater: [selectedVideo, ...userDetails.watchlater] },
      };

      // to update array
      await db
        .collection(usersCollection)
        .updateOne(filter, updateDoc, options);

      res.status(200).json({ message: "Added video to watchlater" });
      client.close();
    } else {
      res.status(403).json({ message: "Unathorized access" });
      client.close();
      return;
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Unable to update watchlater, please try later!" });
  }
});

// remove from watchlater
app.delete("/api/user/watchlater/:id", async (req, res) => {
  const headerToken = req.headers.authorization;
  const videoId = req.params.id;

  const db = await connectDatabase(res);

  try {
    const userDetails = await db
      .collection(usersCollection)
      .findOne({}, { token: headerToken });

    if (userDetails.token === headerToken) {
      const remainingVideos = userDetails.watchlater.filter(
        (video) => video.id !== videoId
      );
      const filter = { token: headerToken };
      const options = { upsert: true };
      const updateDoc = {
        $set: { watchlater: remainingVideos },
      };

      // to update array
      await db
        .collection(usersCollection)
        .updateOne(filter, updateDoc, options);

      res.status(200).json({ message: "Video removed from watchlater" });
      client.close();
    } else {
      res.status(403).json({ message: "Unathorized access" });
      client.close();
      return;
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Unable to remove from watchlater, please try later!" });
  }
});

// history
// get all from history
app.get("/api/user/history", async (req, res) => {
  const headerToken = req.headers.authorization;
  const db = await connectDatabase(res);

  try {
    const userDetails = await db
      .collection(usersCollection)
      .findOne({}, { token: headerToken });

    if (userDetails.token === headerToken) {
      res.send(userDetails.history);
      client.close();
    } else {
      res.status(403).json({ message: "Unathorized access" });
      client.close();
      return;
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Unable to get history, please try later!" });
  }
});

// add to history
app.post("/api/user/history/:videoId", async (req, res) => {
  const headerToken = req.headers.authorization;
  const videoId = req.params.videoId;

  const db = await connectDatabase(res);

  try {
    const userDetails = await db
      .collection(usersCollection)
      .findOne({}, { token: headerToken });

    if (userDetails.token === headerToken) {
      const selectedVideo =
        allVideos.length > 0
          ? allVideos.filter((video) => video._id === videoId)
          : (await db.collection(videosCollection).find({}).toArray()).find(
              (video) => video._id === videoId
            );

      const filter = { token: headerToken };
      const options = { upsert: true };
      const updateDoc = {
        $set: { history: [selectedVideo, ...userDetails.watchlater] },
      };

      // to update array
      await db
        .collection(usersCollection)
        .updateOne(filter, updateDoc, options);

      res.status(200).json({ message: "Added video to history" });
      client.close();
    } else {
      res.status(403).json({ message: "Unathorized access" });
      client.close();
      return;
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Unable to update history, please try later!" });
  }
});

// remove from history
app.delete("/api/user/history/:id", async (req, res) => {
  const headerToken = req.headers.authorization;
  const videoId = req.params.id;

  const db = await connectDatabase(res);

  try {
    const userDetails = await db
      .collection(usersCollection)
      .findOne({}, { token: headerToken });

    if (userDetails.token === headerToken) {
      const remainingVideos = userDetails.watchlater.filter(
        (video) => video.id !== videoId
      );
      const filter = { token: headerToken };
      const options = { upsert: true };
      const updateDoc = {
        $set: { history: remainingVideos },
      };

      // to update array
      await db
        .collection(usersCollection)
        .updateOne(filter, updateDoc, options);

      res.status(200).json({ message: "Video removed from history" });
      client.close();
    } else {
      res.status(403).json({ message: "Unathorized access" });
      client.close();
      return;
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Unable to remove from history, please try later!" });
  }
});

// clear all history
app.delete("/api/user/history", async (req, res) => {
  const headerToken = req.headers.authorization;
  const db = await connectDatabase(res);

  try {
    const userDetails = await db
      .collection(usersCollection)
      .findOne({}, { token: headerToken });

    if (userDetails.token === headerToken) {
      const filter = { token: headerToken };
      const options = { upsert: true };
      const updateDoc = {
        $set: { history: [] },
      };

      // to update array
      await db
        .collection(usersCollection)
        .updateOne(filter, updateDoc, options);

      res.status(200).json({ message: "History cleared" });
      client.close();
    } else {
      res.status(403).json({ message: "Unathorized access" });
      client.close();
      return;
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Unable to clear history, please try later!" });
  }
});

// category
// get all categories
app.get("/api/categories", async (req, res) => {
  try {
    const db = await connectDatabase(res);
    const categories = await db
      .collection(categoriesCollection)
      .find({})
      .toArray();

    res.send(categories).status(200);
    client.close();
  } catch (error) {
    res
      .status(500)
      .json({ message: "Unable to get videos, please try later!" });
  }
});

// get single category
app.get("/api/category/:categoryId", async (req, res) => {
  const categoryId = req.params.categoryId;
  try {
    const db = await connectDatabase(res);
    const allCategories = await db
      .collection(categoriesCollection)
      .find({})
      .toArray();
    const selectedCategory = allCategories.find(
      (category) => category._id === categoryId
    );

    console.log(selectedCategory);
    if (selectedCategory._id === categoryId) {
      res.send(selectedCategory).status(200);
      client.close();
    } else {
      res.status(404).json({ message: "Category not found" });
      return;
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Unable to get categories, please try later!" });
  }
});

// signup
app.post("/api/user/signup", async (req, res) => {
  const body = req.body;

  const encodedToken = createEncodedToken({
    email: body.email,
    password: body.password,
  });

  const newUser = {
    ...body,
    _id: uuid(),
    token: encodedToken,
    likes: [],
    watchlater: [],
    history: [],
    playlists: [],
  };

  delete newUser.password;

  const db = await connectDatabase(res);
  const userDetails = (
    await db.collection(usersCollection).find({}).toArray()
  ).find((user) => user.email === body.email);

  if (userDetails.email === body.email) {
    res.status(422).json({ message: "User already exist" });
    // client.close();
  } else {
    db.collection(usersCollection).insertOne(newUser);
    res
      .status(201)
      .json({ message: "Signed up successfully", token: encodedToken });
    // client.close();
  }
});

// login
app.post("/api/user/login", async (req, res) => {
  const body = req.body;

  const encodedToken = createEncodedToken({
    email: body.email,
    password: body.password,
  });

  const db = await connectDatabase(res);
  try {
    const userFound = await db
      .collection(usersCollection)
      .findOne({}, { token: encodedToken });

    if (userFound.email === body.email) {
      if (userFound.token === encodedToken) {
        res
          .send(userFound)
          .status(200)
          .json({ message: "Logged in successfully" });
        return;
      } else {
        res.status(401).json({ message: "Wrong password" });
        return;
      }
    } else {
      res.status(404).json({ message: "user not found" });
      return;
    }
  } catch (error) {
    res.status(500).json({ message: "Unable to login, please try later!" });
  }
});

app.listen(8000, () => {
  console.log(`port open on ${port}`);
});
