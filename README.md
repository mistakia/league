# League

League is a platform for dynasty football leagues.

## Installation

Setup a mysql database using [`schema.sql`](https://github.com/mistakia/league/blob/master/db/schema.sql).

**Development**

Make sure your local mysql server matches the parameters in [`config.development.js`](https://github.com/mistakia/league/blob/master/config.development.js).
```
yarn install
yarn start
```

**Production**

Install [PM2](https://pm2.keymetrics.io/) on a production server and create a file called `config.production.js` similar to [`config.sample.js`](https://github.com/mistakia/league/blob/master/config.sample.js).
```
yarn install
pm2 start
```

Edit [`ecosystem.config.js`](https://github.com/mistakia/league/blob/master/ecosystem.config.js) to enable `yarn deploy`.
