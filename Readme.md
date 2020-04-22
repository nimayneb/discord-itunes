iTunes Discord Rich Presence Connector
======================================

![Example in Discord](https://github.com/nimayneb/discord-itunes/raw/master/example.png "Example in Discord")

Only for macOS (also Catalina).

Installation:
-------------

`git clone git@github.com:nimayneb/discord-itunes.git`

`cd discord-itunes`

`npm i`

Usage:
------

`npm run watch`

Features:
---------

- Radio only: Shows artist, title and if available album too 
- Music only: Shows artist, album, title w/ track time
- Always: Shows current elapsed time
- Sends activities to Discord on changes only
- Disconnects from Discord if nothing is playing or streaming

Appendix
========

Wishlist:
---------

- Show cover of album, not iTunes logo (Issue: https://github.com/discord/discord-rpc/issues/70)
- Show link to iTunes page
- Show link to Streaming page

Discord Application 
-------------------

URL: https://discordapp.com/developers/applications/695005084505079848/information
URL: https://discordapp.com/developers/applications/702431764781465650/information

Discord - Rich Presence - Assets (w/ authorization)
---------------------------------------------------

URL: https://discordapp.com/api/v6/oauth2/applications/695005084505079848/assets

Request:

    {
      "name":"${name}",
      "image":"data:image/png;base64,${image}",
      "type": "1"
    }