const express = require("express");
const axios = require("axios");

require("dotenv").config();

const app = express();

app.get("/suggest/:searchKey", async (req, res) => {
  const searchKey = req.params.searchKey || "";
  const url = "https://www.google.com/complete/search";
  try {
    const response = await axios.get(url, {
      params: {
        hl: "en",
        q: searchKey,
        gl: "us",
        client: "chrome",
      },
      headers: {
        "User-Agent": "Mozilla/5.0",
      },
    });

    if (response.status != 200) {
      throw new Error(`path: /suggest
         - status: ${response.status} ${response.statusText}`);
    }

    res.json({
      success: true,
      data: response?.data[1],
    });
  } catch (err) {
    console.log(`error = ${err}`);

    res.status(500).json({
      success: false,
      message: "failed to fetch suggestions",
    });
  }
});

const protocol = process.env.PROTOCOL || "http";
const hostName = process.env.HOSTNAME || "localhost";
const port = process.env.PORT || 3000;

app.listen(port, hostName, () => {
  console.log(`Server is listening on ${protocol}://${hostName}:${port}`);
});
