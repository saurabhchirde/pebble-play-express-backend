const express = require("express");
const { MongoClient } = require("mongodb");
const { v4: uuid } = require("uuid");
const sign = require("jwt-encode");
const dotenv = require("dotenv");
const cors = require("cors");

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
app.use(cors());

let allVideos = [];

const createEncodedToken = (data) => {
  return sign(data, process.env.JWT_SECRET_KEY);
};

// get all videos
app.get("/api/videos", async (req, res) => {
  try {
    const client = await MongoClient.connect(url);
    const db = client.db();
    const videos = await db.collection(videosCollection).find({}).toArray();
    allVideos = videos;
    // This describes the lifetime of our resource, telling the CDN to serve from the cache and update in the background (at most once per second).
    res.setHeader("Cache-Control", "s-max-age=1, stale-while-revalidate");
    res.status(200).json({ videos });
    client?.close();
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
    const client = await MongoClient.connect(url);
    const db = client.db();
    const video =
      allVideos.length === 0
        ? (await db.collection(videosCollection).find({}).toArray()).find(
            (video) => video._id === videoId
          )
        : allVideos.find((video) => video._id === videoId);

    if (video._id === videoId) {
      // This describes the lifetime of our resource, telling the CDN to serve from the cache and update in the background (at most once per second).
      res.setHeader("Cache-Control", "s-max-age=1, stale-while-revalidate");
      res.status(200).json({ video });
    } else {
      res.sendStatus(404);
    }
    client?.close();
  } catch (error) {
    res.status(500).json({ message: "Unable to get video, please try later!" });
  }
});

// category
// get all categories
app.get("/api/categories", async (req, res) => {
  try {
    const client = await MongoClient.connect(url);
    const db = client.db();
    const categories = await db
      .collection(categoriesCollection)
      .find({})
      .toArray();

    // This describes the lifetime of our resource, telling the CDN to serve from the cache and update in the background (at most once per second).
    res.setHeader("Cache-Control", "s-max-age=1, stale-while-revalidate");
    res.status(200).json({ categories });
    client?.close();
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
    const client = await MongoClient.connect(url);
    const db = client.db();
    const allCategories = await db
      .collection(categoriesCollection)
      .find({})
      .toArray();

    const selectedCategory = allCategories.find(
      (category) => category._id === categoryId
    );

    if (selectedCategory._id === categoryId) {
      // This describes the lifetime of our resource, telling the CDN to serve from the cache and update in the background (at most once per second).
      res.setHeader("Cache-Control", "s-max-age=1, stale-while-revalidate");
      res.status(200).json({ category: selectedCategory });
      client?.close();
    } else {
      res.status(404).json({ message: "Category not found" });
      client?.close();
      return;
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Unable to get categories, please try later!" });
  }
});

// like
//get all liked videos
app.get("/api/user/likes", async (req, res) => {
  const headerToken = req.headers.authorization;
  const client = await MongoClient.connect(url);
  const db = client.db();

  try {
    const userDetails = (
      await db.collection(usersCollection).find({}).toArray()
    ).find((user) => user.token === headerToken);

    if (userDetails.token === headerToken) {
      // This describes the lifetime of our resource, telling the CDN to serve from the cache and update in the background (at most once per second).
      res.setHeader("Cache-Control", "s-max-age=1, stale-while-revalidate");
      res.status(200).json({ likes: userDetails.likes });
      client?.close();
    } else {
      res.status(403).json({ message: "Unathorized access" });
      client?.close();
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

  const client = await MongoClient.connect(url);
  const db = client.db();

  try {
    const selectedVideo =
      allVideos.length > 0
        ? allVideos.find((video) => video._id === videoId)
        : (await db.collection(videosCollection).find({}).toArray()).find(
            (video) => video._id === videoId
          );

    if (selectedVideo._id === videoId) {
      const userDetails = (
        await db.collection(usersCollection).find({}).toArray()
      ).find((user) => user.token === headerToken);

      if (userDetails.token === headerToken) {
        // to check if already liked
        const isAvailable = userDetails.likes.some(
          (video) => video._id === videoId
        );

        if (isAvailable) {
          res.status(200).json({ message: "Already liked" });
          client?.close();
          return;
        } else {
          const updatedLikes = userDetails.likes.concat(selectedVideo);

          const filter = { token: headerToken };
          const options = { upsert: true };
          const updateDoc = {
            $set: { likes: updatedLikes },
          };
          // to update array
          await db
            .collection(usersCollection)
            .updateOne(filter, updateDoc, options);

          // This describes the lifetime of our resource, telling the CDN to serve from the cache and update in the background (at most once per second).
          res.setHeader("Cache-Control", "s-max-age=1, stale-while-revalidate");
          res.status(200).json({ likes: updatedLikes, message: "Video liked" });
          client?.close();
        }
      } else {
        res.status(403).json({ message: "Unathorized access" });
        client?.close();
        return;
      }
    } else {
      res.status(404).json({ message: "Video not found" });
      client?.close();
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

  const client = await MongoClient.connect(url);
  const db = client.db();

  try {
    const userDetails = (
      await db.collection(usersCollection).find({}).toArray()
    ).find((user) => user.token === headerToken);

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

      // This describes the lifetime of our resource, telling the CDN to serve from the cache and update in the background (at most once per second).
      res.setHeader("Cache-Control", "s-max-age=1, stale-while-revalidate");
      res
        .status(200)
        .json({ likes: remainingVideos, message: "Video removed from like" });
      client?.close();
    } else {
      res.status(403).json({ message: "Unathorized access" });
      client?.close();
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
  const client = await MongoClient.connect(url);
  const db = client.db();

  try {
    const userDetails = (
      await db.collection(usersCollection).find({}).toArray()
    ).find((user) => user.token === headerToken);

    if (userDetails.token === headerToken) {
      // This describes the lifetime of our resource, telling the CDN to serve from the cache and update in the background (at most once per second).
      res.setHeader("Cache-Control", "s-max-age=1, stale-while-revalidate");
      res.status(200).json({ playlists: userDetails.playlists });
      client?.close();
    } else {
      res.status(403).json({ message: "Unathorized access" });
      client?.close();
      return;
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Unable to get playlists, please try later!" });
  }
});

// get single playlist
app.get("/api/user/playlists/:playlistId", async (req, res) => {
  const headerToken = req.headers.authorization;
  const playlistId = req.params.playlistId;

  const client = await MongoClient.connect(url);
  const db = client.db();

  try {
    const userDetails = (
      await db.collection(usersCollection).find({}).toArray()
    ).find((user) => user.token === headerToken);

    if (userDetails.token === headerToken) {
      const selectedPlaylist = userDetails.playlists.find(
        (playlist) => playlist.id === playlistId
      );

      if (selectedPlaylist) {
        // This describes the lifetime of our resource, telling the CDN to serve from the cache and update in the background (at most once per second).
        res.setHeader("Cache-Control", "s-max-age=1, stale-while-revalidate");
        res.status(200).json({ playlist: selectedPlaylist });
        client?.close();
      } else {
        res.status(404).json({ message: "Playlist not found" });
        client?.close();
        return;
      }
    } else {
      res.status(403).json({ message: "Unathorized access" });
      client?.close();
      return;
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Unable to get playlists, please try later!" });
  }
});

// create playlist
app.post("/api/user/playlists", async (req, res) => {
  const headerToken = req.headers.authorization;
  const body = req.body;

  const client = await MongoClient.connect(url);
  const db = client.db();

  const newPlaylist = { id: uuid(), ...body, videos: [] };

  if (!body.title) {
    res.status(400).json({ message: "Playlist name cannot be blank" });
    client?.close();
    return;
  }

  try {
    const userDetails = (
      await db.collection(usersCollection).find({}).toArray()
    ).find((user) => user.token === headerToken);

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

      // This describes the lifetime of our resource, telling the CDN to serve from the cache and update in the background (at most once per second).
      res.setHeader("Cache-Control", "s-max-age=1, stale-while-revalidate");
      res
        .status(201)
        .json({ message: "Playlist created", playlists: updatedPlaylists });
      client?.close();
    } else {
      res.status(403).json({ message: "Unathorized access" });
      client?.close();
      return;
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Unable to create playlists, please try later!" });
  }
});

// add video to playlist
app.post("/api/user/playlists/:playlistId/video/:videoId", async (req, res) => {
  const headerToken = req.headers.authorization;
  const playlistId = req.params.playlistId;
  const videoId = req.params.videoId;

  const client = await MongoClient.connect(url);
  const db = client.db();

  try {
    const userDetails = (
      await db.collection(usersCollection).find({}).toArray()
    ).find((user) => user.token === headerToken);

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
              ? allVideos.find((video) => video._id === videoId)
              : (await db.collection(videosCollection).find({}).toArray()).find(
                  (video) => video._id === videoId
                );

          if (!selectedVideo) {
            res.status(404).json({ message: "Video not found" });
            client?.close();
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

          // This describes the lifetime of our resource, telling the CDN to serve from the cache and update in the background (at most once per second).
          res.setHeader("Cache-Control", "s-max-age=1, stale-while-revalidate");
          res.status(200).json({
            playlist: { ...selectedPlaylist, videos: updatedPlaylistVideos },
          });
          client?.close();
        } else {
          res
            .status(409)
            .json({ message: "Video is already added in your playlist" });
          client?.close();
          return;
        }
      } else {
        res.status(404).json({ message: "Playlist not found" });
        client?.close();
        return;
      }
    } else {
      res.status(403).json({ message: "Unathorized access" });
      client?.close();
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
  "/api/user/playlists/:playlistId/video/:videoId",
  async (req, res) => {
    const headerToken = req.headers.authorization;
    const playlistId = req.params.playlistId;
    const videoId = req.params.videoId;

    const client = await MongoClient.connect(url);
    const db = client.db();

    try {
      const userDetails = (
        await db.collection(usersCollection).find({}).toArray()
      ).find((user) => user.token === headerToken);

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

            // This describes the lifetime of our resource, telling the CDN to serve from the cache and update in the background (at most once per second).
            res.setHeader(
              "Cache-Control",
              "s-max-age=1, stale-while-revalidate"
            );
            res.status(200).json({
              message: "Video removed from playlist",
              playlist: updatedPlaylists,
            });
            client?.close();
          } else {
            res.status(404).json({ message: "Video not found" });
            client?.close();
            return;
          }
        } else {
          res.status(404).json({ message: "Playlist not found" });
          client?.close();
          return;
        }
      } else {
        res.status(403).json({ message: "Unathorized access" });
        client?.close();
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
app.delete("/api/user/playlists/:id", async (req, res) => {
  const headerToken = req.headers.authorization;
  const playlistId = req.params.id;

  const client = await MongoClient.connect(url);
  const db = client.db();

  try {
    const userDetails = (
      await db.collection(usersCollection).find({}).toArray()
    ).find((user) => user.token === headerToken);

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

        // This describes the lifetime of our resource, telling the CDN to serve from the cache and update in the background (at most once per second).
        res.setHeader("Cache-Control", "s-max-age=1, stale-while-revalidate");
        res
          .status(200)
          .json({ playlists: remainingPlaylists, message: "Playlist deleted" });
        client?.close();
      } else {
        res.status(404).json({ message: "Playlist not found" });
      }
    } else {
      res.status(403).json({ message: "Unathorized access" });
      client?.close();
      return;
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Unable to delete playlists, please try later!" });
  }
});

// watchlater
// get all watchlater
app.get("/api/user/watchlater", async (req, res) => {
  const headerToken = req.headers.authorization;
  const client = await MongoClient.connect(url);
  const db = client.db();

  try {
    const userDetails = (
      await db.collection(usersCollection).find({}).toArray()
    ).find((user) => user.token === headerToken);

    if (userDetails.token === headerToken) {
      // This describes the lifetime of our resource, telling the CDN to serve from the cache and update in the background (at most once per second).
      res.setHeader("Cache-Control", "s-max-age=1, stale-while-revalidate");
      res.status(200).json({ watchlater: userDetails.watchlater });
      client?.close();
    } else {
      res.status(403).json({ message: "Unathorized access" });
      client?.close();
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

  const client = await MongoClient.connect(url);
  const db = client.db();

  try {
    const userDetails = (
      await db.collection(usersCollection).find({}).toArray()
    ).find((user) => user.token === headerToken);

    if (userDetails.token === headerToken) {
      const selectedVideo =
        allVideos.length > 0
          ? allVideos.find((video) => video._id === videoId)
          : (await db.collection(videosCollection).find({}).toArray()).find(
              (video) => video._id === videoId
            );

      const updatedWatchlater = [selectedVideo, ...userDetails.watchlater];

      const filter = { token: headerToken };
      const options = { upsert: true };
      const updateDoc = {
        $set: { watchlater: updatedWatchlater },
      };

      // to update array
      await db
        .collection(usersCollection)
        .updateOne(filter, updateDoc, options);

      // This describes the lifetime of our resource, telling the CDN to serve from the cache and update in the background (at most once per second).
      res.setHeader("Cache-Control", "s-max-age=1, stale-while-revalidate");
      res.status(200).json({
        watchlater: updatedWatchlater,
        message: "Added video to watchlater",
      });
      client?.close();
    } else {
      res.status(403).json({ message: "Unathorized access" });
      client?.close();
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

  const client = await MongoClient.connect(url);
  const db = client.db();

  try {
    const userDetails = (
      await db.collection(usersCollection).find({}).toArray()
    ).find((user) => user.token === headerToken);

    if (userDetails.token === headerToken) {
      const remainingVideos = userDetails.watchlater.filter(
        (video) => video._id !== videoId
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

      // This describes the lifetime of our resource, telling the CDN to serve from the cache and update in the background (at most once per second).
      res.setHeader("Cache-Control", "s-max-age=1, stale-while-revalidate");
      res.status(200).json({
        watchlater: remainingVideos,
        message: "Video removed from watchlater",
      });
      client?.close();
    } else {
      res.status(403).json({ message: "Unathorized access" });
      client?.close();
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
  const client = await MongoClient.connect(url);
  const db = client.db();

  try {
    const userDetails = (
      await db.collection(usersCollection).find({}).toArray()
    ).find((user) => user.token === headerToken);

    if (userDetails.token === headerToken) {
      // This describes the lifetime of our resource, telling the CDN to serve from the cache and update in the background (at most once per second).
      res.setHeader("Cache-Control", "s-max-age=1, stale-while-revalidate");
      res.status(200).json({ history: userDetails.history });
      client?.close();
    } else {
      res.status(403).json({ message: "Unathorized access" });
      client?.close();
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

  const client = await MongoClient.connect(url);
  const db = client.db();

  try {
    const userDetails = (
      await db.collection(usersCollection).find({}).toArray()
    ).find((user) => user.token === headerToken);

    if (userDetails.token === headerToken) {
      const selectedVideo =
        allVideos.length > 0
          ? allVideos.find((video) => video._id === videoId)
          : (await db.collection(videosCollection).find({}).toArray()).find(
              (video) => video._id === videoId
            );

      const updatedHistory = [selectedVideo, ...userDetails.watchlater];

      const filter = { token: headerToken };
      const options = { upsert: true };
      const updateDoc = {
        $set: { history: updatedHistory },
      };

      // to update array
      await db
        .collection(usersCollection)
        .updateOne(filter, updateDoc, options);

      // This describes the lifetime of our resource, telling the CDN to serve from the cache and update in the background (at most once per second).
      res.setHeader("Cache-Control", "s-max-age=1, stale-while-revalidate");
      res
        .status(200)
        .json({ history: updatedHistory, message: "Added video to history" });
      client?.close();
    } else {
      res.status(403).json({ message: "Unathorized access" });
      client?.close();
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

  const client = await MongoClient.connect(url);
  const db = client.db();

  try {
    const userDetails = (
      await db.collection(usersCollection).find({}).toArray()
    ).find((user) => user.token === headerToken);

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

      // This describes the lifetime of our resource, telling the CDN to serve from the cache and update in the background (at most once per second).
      res.setHeader("Cache-Control", "s-max-age=1, stale-while-revalidate");
      res.status(200).json({
        history: remainingVideos,
        message: "Video removed from history",
      });
      client?.close();
    } else {
      res.status(403).json({ message: "Unathorized access" });
      client?.close();
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
  const client = await MongoClient.connect(url);
  const db = client.db();

  try {
    const userDetails = (
      await db.collection(usersCollection).find({}).toArray()
    ).find((user) => user.token === headerToken);

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

      // This describes the lifetime of our resource, telling the CDN to serve from the cache and update in the background (at most once per second).
      res.setHeader("Cache-Control", "s-max-age=1, stale-while-revalidate");
      res.status(200).json({ history: [], message: "History cleared" });
      client?.close();
    } else {
      res.status(403).json({ message: "Unathorized access" });
      client?.close();
      return;
    }
  } catch (error) {
    res
      .status(500)
      .json({ message: "Unable to clear history, please try later!" });
  }
});

// signup
app.post("/api/auth/signup", async (req, res) => {
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

  const client = await MongoClient.connect(url);
  const db = client.db();
  const userDetails = (
    await db.collection(usersCollection).find({}).toArray()
  ).find((user) => user.email === body.email);

  if (userDetails?.email === body.email) {
    res.status(422).json({
      message: "User already exist",
    });
  } else {
    db.collection(usersCollection).insertOne(newUser); // This describes the lifetime of our resource, telling the CDN to serve from the cache and update in the background (at most once per second).
    res.setHeader("Cache-Control", "s-max-age=1, stale-while-revalidate");
    res.status(201).json({
      createdUser: newUser,
      encodedToken,
      message: "Signed up successfully",
    });
  }
  client?.close();
});

// login
app.post("/api/auth/login", async (req, res) => {
  const body = req.body;

  const encodedToken = createEncodedToken({
    email: body.email,
    password: body.password,
  });

  const client = await MongoClient.connect(url);
  const db = client.db();
  try {
    const userFound = (
      await db.collection(usersCollection).find({}).toArray()
    ).find((user) => user.token === encodedToken);

    if (userFound?.email === body.email) {
      if (userFound.token === encodedToken) {
        // This describes the lifetime of our resource, telling the CDN to serve from the cache and update in the background (at most once per second).
        res.setHeader("Cache-Control", "s-max-age=1, stale-while-revalidate");
        res.status(200).json({
          foundUser: userFound,
          encodedToken,
          message: "Logged in successfully",
        });
        client?.close();
        return;
      } else {
        res.status(401).json({ message: "Wrong password" });
        client?.close();
        return;
      }
    } else {
      res.status(404).json({ message: "user not found" });
      client?.close();
      return;
    }
  } catch (error) {
    res.status(500).json({ message: "Unable to login, please try later!" });
  }
});

app.listen(8000, () => {
  console.log(`port open on ${port}`);
});

// Export the Express API
module.exports = app;
