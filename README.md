# 🎧 AutoGenre EQ for Spicetify

![AutoGenre EQ Logo](cover.png)

**AutoGenre EQ** is an intelligent, automated Equalizer extension for Spicetify. It dynamically analyzes the currently playing song and automatically applies the perfect EQ profile based on its genre, artists, and metadata. It's built with performance in mind and perfectly complements any dark, minimal, or terminal-themed Spotify setups!

## ✨ Features

- **🤖 Smart Auto-EQ:** Uses multiple strategies (Spotify API, iTunes API fallback, and Internal Metadata) to detect track genres with extreme accuracy while bypassing API rate limits.
- **🎛️ 20+ Custom Presets:** Perfectly tuned EQ bands for Electronic, Hip-Hop, Pop, Mexicana, Reggaeton, Rock, Metal, Acoustic, and many more!
- **💾 Per-Track Saving:** Found a better EQ for a specific song? Save it manually, and it will be remembered the next time you play it.
- **🔊 Advanced Audio Controls:** Built-in Preamp, Bass Boost, Stereo Widening, and a dynamic Audio Compressor for true audiophiles.
- **🚀 Performance Focused:** Fully optimized for low-latency audio processing, with a sleek UI built straight into Spicetify's Topbar.

## 🛠️ Installation

1. Copy the `audioEnhancer.js` file into your Spicetify `Extensions` folder.
2. Run the following commands in your terminal:
   ```bash
   spicetify config extensions audioEnhancer.js
   spicetify apply
   ```

## ⚙️ How it Works

The extension hooks into the Spotify Web Audio API. When a track changes, AutoGenre EQ:
1. Checks if a manual preset was saved for the track.
2. Checks its local cache for the artist.
3. If not cached, fetches genres from the Spotify Web API.
4. If rate-limited, falls back to the iTunes Search API.
5. Applies the closest matching audio preset dynamically!

---
**Created by:** AMorales22T
