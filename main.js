const { app, Tray, nativeImage } = require('electron');
const child_process = require("child_process");
const fs = require("fs");
const { Client } = require('@xhayper/discord-rpc');

function loadDiscord() {
    try {
        global.discord = new Client({
            clientId: "1136028963903385610"
        });

        discord.on("ready", () => {
            setInterval(() => {
                refreshDiscord(discord);
            }, 15000);
        });

        discord.login();
    } catch (e) {
        loadDiscord();
    }
}

let discordData = null;

function refreshDiscord(discord) {
    try {
        if (discordData === null) {
            discord.user.clearActivity();
        } else {
            discord.user.setActivity(discordData);
        }
    } catch (e) {
        loadDiscord();
    }
}

try {
    loadDiscord();
} catch (e) {
    loadDiscord();
}

app.disableHardwareAcceleration();
let lastID = "";

function getAppleMusic() {
    return new Promise((res) => {
        let p = child_process.execFile("osascript", [ "./scripts/running.scpt", "-s", "o" ], { cwd: __dirname, stdio: "pipe" });

        p.stderr.on('data', (data) => {
            if (data.toString().trim() === "false") {
                res(false);
            } else {
                let p = child_process.execFile("osascript", [ "./scripts/info.scpt", "-s", "o" ], { cwd: __dirname, stdio: "pipe" });

                p.stderr.on('data', (data) => {
                    try {
                        res(JSON.parse(data.toString()));
                    } catch (e) {
                        res(false);
                    }
                });
            }
        });
    });
}

async function refresh() {
    let data;

    try {
        data = await getAppleMusic();
        console.log(data);
        if (data === false) throw new Error();
        if (data['persistentID'] === lastID) return;

        if (fs.existsSync(__dirname + "/scripts/.artwork.jpg")) fs.unlinkSync(__dirname + "/scripts/.artwork.jpg");
        if (fs.existsSync(__dirname + "/scripts/.artwork.png")) fs.unlinkSync(__dirname + "/scripts/.artwork.png");
        if (fs.existsSync(__dirname + "/tray/16x16@2x.jpg")) fs.unlinkSync(__dirname + "/tray/16x16@2x.jpg");
        if (fs.existsSync(__dirname + "/tray/16x16@2x.png")) fs.unlinkSync(__dirname + "/tray/16x16@2x.png");

        child_process.execFileSync("osascript", [ "./scripts/art.scpt", "-s", "o" ], { cwd: __dirname, stdio: "ignore" });

        if (fs.existsSync(__dirname + "/scripts/.artwork.jpg")) {
            fs.renameSync(__dirname + "/scripts/.artwork.jpg", __dirname + "/tray/16x16@2x.jpg");
        } else {
            fs.renameSync(__dirname + "/scripts/.artwork.png", __dirname + "/tray/16x16@2x.png");
        }

        let img = nativeImage.createFromPath(fs.existsSync(__dirname + "/tray/16x16@2x.jpg") ? __dirname + "/tray/16x16@2x.jpg" : __dirname + "/tray/16x16@2x.png");
        img = img.resize({
            width: 24,
            height: 24
        });

        tray.setTitle("\xa0\xa0" + data.artist + " - " + data.name);
        tray.setImage(img);

        let albumArt = "https://cdn.discordapp.com/app-icons/1136028963903385610/9f14e1a37ee238abd3c5f28a8f083daf.png";
        let query = "?query=" + encodeURIComponent(`"${data.albumArtist}" "${data.album}"`) + "&limit=1&fmt=json";
        let musicbrainzData;

        try {
            musicbrainzData = await (await fetch("https://musicbrainz.org/ws/2/release-group" + query)).json();
        } catch (e) {
            musicbrainzData = {};
        }

        if (musicbrainzData['release-groups'] && musicbrainzData['release-groups'].length > 0) {
            let id = musicbrainzData['release-groups'][0].id;
            let coverData;

            try {
                coverData = await (await fetch("https://coverartarchive.org/release-group/" + id + "/")).json();
            } catch (e) {
                coverData = {};
            }

            if (coverData.images && coverData.images.length > 0) {
                albumArt = coverData['images'][0]['thumbnails']['250'] ?? coverData['images'][0]['image'];
            }
        }

        discordData = {
            details: data.name,
            state: data.artist,
            largeImageText: data.album,
            largeImageKey: albumArt
        }
        refreshDiscord(discord);

        lastID = data['persistentID'];
    } catch (e) {
        console.error(e);

        tray.setTitle("");
        tray.setImage(__dirname + "/tray/empty.png");
        lastID = null;

        discordData = null;
    }
}

app.whenReady().then(() => {
    app.dock.hide();

    global.tray = new Tray(__dirname + "/tray/16x16Template@2x.png");

    setInterval(refresh, 2000);
    refresh();
});