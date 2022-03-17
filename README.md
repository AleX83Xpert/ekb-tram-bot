This bot shows trams locations in Ekaterinburg city using oficial data got from http://ettu.ru

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
MAPQUEST_KEY="..."
ETTU_API_KEY="111"
```

#### BOT_TOKEN
This is your telegram bot token

#### MAPQUEST_KEY
To show map tiles and markers bot uses `Open Static Map API`: https://developer.mapquest.com/documentation/open/static-map-api/v5/map/
Please get the key here: https://developer.mapquest.com/user/me/apps

#### ETTU_API_KEY
I don't know, just copy this value from http://map.ettu.ru

## Starting
```
npm i
npm start
```

or

```
docker-compose up -d
```
