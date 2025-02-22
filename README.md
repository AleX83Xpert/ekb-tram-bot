This bot shows trams locations in Ekaterinburg city using official data got from http://ettu.ru

## Demo
See boot in action: [@EkbTramBot](https://t.me/EkbTramBot)

## Screenshots

### Chat with bot
![image](https://user-images.githubusercontent.com/25384290/152334853-94aea7c4-6888-40c8-b743-d4a9790bd5c9.png)

### Inline messages
![image](https://user-images.githubusercontent.com/25384290/152558061-b5e4c21c-f4dc-421a-b0ae-86563c27c45c.png)

![image](https://user-images.githubusercontent.com/25384290/152558111-da9b8d40-49fa-40b4-8acb-365af5f60180.png)

## Settings .env
You must set tokens&keys using `.env` file:
```
BOT_TOKEN="..."

# Use next two values if you use MapQuest service
# MAP_SERVICE="MAPQUEST"
# MAP_SERVICE_CONFIG={"key": "<key>"}

#
# OR
#

# Use next two values if you use MapBox service
# MAP_SERVICE="MAPBOX"
# MAP_SERVICE_CONFIG={"accessToken": "<token>"}

ETTU_API_KEY="111"
```

#### BOT_TOKEN
This is your telegram bot token

#### MAP_SERVICE
There are two possible values: `MAPQUEST` and `MAPBOX`

##### `MAPQUEST`
To show map tiles and markers bot uses static Map API: https://developer.mapquest.com/documentation/static-map-api/v5/

Please get the key here: https://developer.mapquest.com/user/me/apps

##### `MAPBOX`
Uses the MapBox service: https://docs.maptiler.com/cloud/api/static-maps/

You may gey token here: https://cloud.maptiler.com/account/keys/

#### ETTU_API_KEY
I don't know, just copy this value from http://map.ettu.ru

## Starting

### Locally
```
npm i
npm build
npm start
```

### On prod environment (just an option)

1. Copy `docker-compose.yml` in some directory on your server

2. Create `.env` file in the same directory (see `.env.example`)

3. Build the app
```bash
docker build . -t ekb-tram-bot-app:latest
```

4. Upload image to the server
```bash
docker save ekb-tram-bot-app:latest | ssh user@server "docker load"
```

5. Login to server via ssh

6. Go to directory with .env and docker-compose.yml

7. Up the container
```bash
docker compose up -d ekb-tram-bot-app
```
