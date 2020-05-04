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
- Radio only: Shows logo of current station if available (1) 
- Music only: Shows artist, album, title w/ track time
- Always: Shows current elapsed time
- Always: Sends activities to Discord on changes only
- Always: Disconnects from Discord if nothing is playing or streaming

(1) see https://gist.github.com/nimayneb/f9f51af6dd8ed7c52959da38c2f93af7

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
