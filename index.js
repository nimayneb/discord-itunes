'use strict';

/**
 * Runs AppleScript only on macOS and returns as string.
 *
 * @param {string} script
 *
 * @returns {Promise<string>}
 */
function runAppleScript(script) {
    try {
        return new Promise((resolve, reject) => {
            appleScript.execString(script, (error, returns) => {
                if (error) {
                    reject(error);
                }
                resolve(returns);
            });
        });
    } catch (error) {
        console.error(error);
        return null;
    }
}

/**
 * Depending on the macOS, the application name is different.
 *
 * macOS <= 10.14 (Mojave) => iTunes
 * macOS >= 10.15 (Catalina) => Music
 *
 * @returns {string}
 */
function getNameOfMusicApplication() {
    return (parseInt(require("os").release().split(".")[0]) >= 19) ? 'Music' : 'iTunes';
}

/**
 * Initialize RPC client for an upcoming connection.
 *
 * Problem:
 * When a track is paused or ended, the RPC's connection will be closed (reason: reduce resources).
 * However, calling the "connect" method of the RPC client again can no longer trigger the "connected" event.
 *
 * Workaround:
 * So we create a new instance again.
 *
 * @returns {Client}
 */
function initializeRemoteDiscordClient() {
    const discordRemoteProtocol = require("discord-rpc");

    return new discordRemoteProtocol.Client({transport: 'ipc'})
        .on('connected', async () => await checkCurrentApplicationState());
}

/**
 * Fetches data content from URL and fails if status code is not 200.
 *
 * @param url
 *
 * @returns {Promise<any>}
 */
async function fetchUrl(url) {
    return await fetch(url, {redirect: 'manual'})
        .then(function (response) {
            if (200 !== response.status) {
                throw new Error(url);
            }

            return response.text();
        })
    ;
}

/**
 * Send specific data for playing mode (Apple Music) to Discord.
 *
 * Read the additional information from application of current track:
 * - Track total time
 * - Elapsed time (1)
 *
 * (1) Discord automatically continues the elapsed time until we send something new.
 *
 * @param trackName
 * @param artistName
 * @param albumName
 *
 * @returns {Promise<void>}
 */
async function sendPlayingToDiscord(trackName, artistName, albumName) {
    console.log(`Now playing "${trackName}" by "${artistName}" from "${albumName}"...`);

    let start = await runAppleScript(`tell application "${applicationName}" to get player position`);
    let end = await runAppleScript(`tell application "${applicationName}" to get time of current track`);
    let now = Number(new Date());

    let startTimestamp = now - (start * 1000);

    await discordSend(
        `🎵 ${trackName} 🕘 ${end}`,
        `👤 ${artistName}`,
        `💿 ${albumName}`,
        startTimestamp
    );
}

/**
 * Send specific data for listening mode (Apple Radio) to Discord.
 *
 * Add additional information:
 * - Elapsed time (1)
 *
 * (1) Discord automatically continues the elapsed time until we send something new.
 *
 * @param trackName
 * @param artistName
 * @param albumName
 *
 * @returns {Promise<void>}
 */
async function sendListeningToDiscord(trackName, artistName, albumName) {
    let startTimestamp = Number(new Date());
    let imageText = `📻 ${currentStationName}`;

    if (albumName) {
        imageText = `💿 ${albumName}`;

        console.log(`Now listening "${trackName}" by "${artistName}" from "${albumName}" at "${currentStationName}"...`);
    } else {
        console.log(`Now listening "${trackName}" by "${artistName}" at "${currentStationName}"...`);
    }

    await discordSend(`🎵 ${trackName}`, `👤 ${artistName}`, imageText, startTimestamp);
}

/**
 * Send data to Discord Rich Presence API
 *
 * @param details
 * @param state
 * @param imageText
 * @param startTimestamp
 *
 * @returns {Promise<void>}
 */
async function discordSend(details, state, imageText, startTimestamp) {
    let stationLogo = 'itunes';

    if (currentStationName) {
        stationLogo = getStationKeyName(currentStationName);
    }

    await discordClient.setActivity({
        details: details,
        state: state,
        startTimestamp: startTimestamp,
        largeImageKey: stationLogo,
        largeImageText: imageText,
        smallImageKey: 'github',
        smallImageText: `nimayneb/discord-itunes (${packageJson.version})`
    }).catch((error) => {
        console.error(error);
    });
}

/**
 * Fetches information about the current track of the current streaming station.
 *
 * Strategy: Uses the JSON-API from "radio.net" and gets the only streaming track.
 *
 * GET: https://api.radio.net/info/v2/search/nowplaying
 * URI: apikey=...
 *      numberoftitles=1
 *      station=...
 * [
 *   {
 *             songName: use it for view in "details"
 *            albumName: use it for view in "state"
 *      coverImageUrl30: ignore
 *     coverImageUrl100: ignore
 *          idBroadcast: ignore
 *     mediaReleaseDate: ignore
 *                genre: ignore
 *      coverImageUrl60: ignore
 *          streamTitle: split into artist name and track name if songName and artistName are empty.
 *           artistName: use it for view in "largeImageText"
 *        purchaseInfos: ignore
 *               source: ignore
 *   }
 * ]
 *
 * TODO:
 * - show streaming broadcast logo
 *
 * @returns {Promise<void>}
 */
async function fetchTrackData() {
    let nowPlayingOnStation = `https://api.radio.net/info/v2/search/nowplaying?apikey=${radioApiKey}&numberoftitles=1&station=${currentStationId}`;

    fetchUrl(nowPlayingOnStation).then(function (response) {
        let data = JSON.parse(response);
        let trackData = data[0];
        let streamTitle = trackData.streamTitle.split(' - ', 2);
        let artistName = trackData.artistName ? trackData.artistName : (streamTitle[0] ? streamTitle[0] : 'N/A');
        let trackName = trackData.songName ? trackData.songName : (streamTitle[1] ? streamTitle[1] : 'N/A');
        let albumName = trackData.albumName ? trackData.albumName : '';
        let current = JSON.stringify({trackName: trackName, artistName, albumName});

        if (current !== previousStreaming) {
            previousStreaming = current;
            sendListeningToDiscord(trackName, artistName, albumName);
        }
    });
}

/**
 * Get station named key for "radio.net"
 *
 * @returns {string|null}
 */
function getStationKeyName(stationName) {
    return (stationName in knownStations) ? knownStations[stationName] : stationName;
}

/**
 * Fetches information about the streaming station powered by "radio.net".
 *
 * Strategy: Grabs only "StationId" within JavaScript on Website (search for "var stationPage = { id: ... }").
 *
 * @param stationName
 *
 * @returns {Promise<void>}
 */
async function fetchStation(stationName) {
    if (currentStationName !== stationName) {
        let stationUrl = `https://www.radio.net/s/${getStationKeyName(stationName)}`;

        fetchUrl(stationUrl).then(await function (stationData) {
            let matches = stationData.replace(/\s/g, '|').match(
                /var\|+stationPage\|*=\|*\{.*[\\,]?id:\|*'(?<stationId>[0-9]+)'.*};/
            );

            let stationId = matches[1];

            if (stationId) {
                console.log(`Listening streaming broadcast "${stationName}"...`);

                currentStationId = stationId;
                currentStationName = stationName;
                requestedClientId = iTunesRadioClientId;

                if (activatedClientId === iTunesRadioClientId) {
                    fetchTrackData();
                }
            }
        });
    } else if (currentStationId) {
        await fetchTrackData();
    }
}

/**
 * Checks the playback state in the application.
 *
 * Data is only sent to Discord if something changes:
 * - Title of current track
 * - Artist of current track
 * - Album of current track
 *
 * TODO:
 * - show cover of album
 *
 * @returns {Promise<void>}
 */
async function checkCurrentApplicationState() {
    let trackNameOrStationName = await runAppleScript(`tell application "${applicationName}" to get name of current track`);
    let artistName = await runAppleScript(`tell application "${applicationName}" to get artist of current track`);
    let albumName = await runAppleScript(`tell application "${applicationName}" to get album of current track`);
    let current = JSON.stringify({trackName: trackNameOrStationName, artistName, albumName});

    if ((trackNameOrStationName && artistName && albumName) && (current !== previousPlaying)) {
        requestedClientId = iTunesMusicClientId;
        previousStreaming = '';
        previousPlaying = current;

        await sendPlayingToDiscord(trackNameOrStationName, artistName, albumName);
    } else if (trackNameOrStationName && !artistName && !albumName) {
        previousPlaying = '';
        await fetchStation(trackNameOrStationName);
    }

    loggedIn = true;
}

/**
 * Close the connection to discord
 */
function closeConnection() {
    discordClient.destroy();

    discordClient = initializeRemoteDiscordClient();
    loggedIn = false;
    previousPlaying = '';
}

/**
 * Retrieves the player status from iTunes / Music.
 * Connects to our "Discord Application" to send new data.
 *
 * If nothing is played, "Discord Client" is logged out.
 *
 * @returns {Promise<void>}
 */
async function setActivity() {
    let playing = await runAppleScript(`tell application "${applicationName}" to get player state`);

    switch (playing) {
        case 'playing': {
            if (!loggedIn) {
                console.log(`Connecting Discord with application id "${activatedClientId}"...`)

                discordClient.connect(activatedClientId).catch(console.error);
            } else if (requestedClientId !== activatedClientId) {
                console.log('Switching Discord connection...');

                activatedClientId = requestedClientId;
                currentStationId = '';
                currentStationName = '';

                closeConnection();
            } else {
                await checkCurrentApplicationState();
            }

            break;
        }

        // case paused

        default: {
            if (loggedIn) {
                console.info('Nothing is played.');

                closeConnection();
            }
        }
    }
}

/************************
 *  Starts Application  *
 ************************/

const appleScript = require("applescript");
const fetch = require('node-fetch');
const iTunesMusicClientId = '695005084505079848';
const iTunesRadioClientId = '702431764781465650';
const radioApiKey = '6d3a0b9a08fd4b6dce0f49e9a72a972675d26a14';
const gistId = 'f9f51af6dd8ed7c52959da38c2f93af7';
const gistAssetId = '64b9ec9bf98fa40f6fab58e7083af85721de8cea';

let knownStations;
let packageJson = require('./package.json');
let applicationName = getNameOfMusicApplication();
let discordClient = initializeRemoteDiscordClient();
let requestedClientId = iTunesMusicClientId;
let currentStationName = '';
let currentStationId = '';
let activatedClientId = requestedClientId;

let previousPlaying = '';
let previousStreaming = '';
let loggedIn = false;

/**
 * TODO:
 * - recall setInterval (1s for playing, 5s for streaming)
 *
 * @see checkCurrentApplicationState
 */
runAppleScript(`version of app "${applicationName}"`).then((version) => {
    console.log(`${applicationName} ${version}`);

    fetchUrl(`https://gist.githubusercontent.com/nimayneb/${gistId}/raw/${gistAssetId}/stations.v2.json`)
        .then((data) => {
            try {
                knownStations = JSON.parse(data);

                console.log(`Loaded ${knownStations.length} station assets.`);
            } catch (e) {
                console.log(`!! Cannot load station assets !!`);
            }

            /**
             * Checks the activity of the application every second.
             * It's a good compromise for music timing (among us: nobody will notice).
             */
            setActivity().then(async () => {
                await setInterval(async () => {
                    await setActivity();
                }, 5000);
            });
        })
    ;
});
