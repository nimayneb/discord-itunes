'use strict';

/**
 * Runs AppleScript only on macOS and returns as string.
 *
 * @param {string} script
 *
 * @returns {Promise<string>}
 */
async function runAppleScript(script) {
    try {
        return new Promise((resolve, reject) => {
            appleScript.execString(script, (error, returns) => {
                if (error) {
                    reject(error);
                }
                resolve(returns);
            });
        });
    }
    catch (error) {
        console.error(error);
        return '';
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
function getNameOfItunes() {
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
        .on('connected', async () => {
            await checkCurrentApplicationState();
        });
}

/**
 * Checks the playback state in the application.
 *
 * Data is only sent to Discord if something changes:
 * - Title of current track
 * - Artist of current track
 * - Album of current track
 *
 * Additional data will be sent:
 * - Track total time
 * - Elapsed time (1)
 *
 * (1) Discord automatically continues the elapsed time until we send something new.
 *
 * TODO:
 * - show cover of album
 * - show current iTunes / Music version (already fetched)
 *
 * @returns {Promise<void>}
 */
async function checkCurrentApplicationState() {
    let trackName = await runAppleScript(`tell application "${applicationName}" to get name of current track`);
    let artist = await runAppleScript(`tell application "${applicationName}" to get artist of current track`);
    let album = await runAppleScript(`tell application "${applicationName}" to get album of current track`);
    let current = JSON.stringify({trackName, artist, album});

    if (('' !== trackName && '' !== artist && '' !== album) && (current !== previous)) {
        previous = current;

        let start = await runAppleScript(`tell application "${applicationName}" to get player position`);
        let end = await runAppleScript(`tell application "${applicationName}" to get time of current track`);
        let now = Number(new Date());

        let actualStart = now - (start * 1000);

        console.log(`Now playing "${trackName}" from "${artist}" by "${album}"...`);

        discordClient.setActivity({
            details: `🎵  ${trackName} [${end}]`,
            state: `👤  ${artist}`,
            startTimestamp: actualStart,
            largeImageKey: 'itunes',
            largeImageText: `💿  ${album}`,
            smallImageKey: 'github',
            smallImageText: 'nimayneb/discord-itunes'
        }).catch((error) => {
            console.error(error);
        });
    }

    loggedIn = true;
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
                discordClient.connect('695005084505079848').catch(console.error);
            } else {
                await checkCurrentApplicationState();
            }

            break;
        }

        // case paused

        default: {
            if (loggedIn) {
                console.info('Nothing is played.');

                await discordClient.destroy();
                discordClient = initializeRemoteDiscordClient();
                loggedIn = false;
                previous = '';
            }
        }
    }
}

/************************\
 *  Starts Application  *
\************************/

const appleScript = require("applescript");

let applicationName = getNameOfItunes();
let discordClient = initializeRemoteDiscordClient();

let previous = '';
let loggedIn = false;

/**
 * TODO: prepared application version to use it for "smallImageText"
 *
 * @see checkCurrentApplicationState
 */
runAppleScript(`version of app "${applicationName}"`).then((version) => {
    console.log(`${applicationName} ${version}`);

    /**
     * Checks the activity of the application every second.
     * It's a good compromise for music timing (among us: nobody will notice).
     */
    setActivity().then(() => {
        setInterval(async () => {
            await setActivity();
        }, 1000);
    });
});
