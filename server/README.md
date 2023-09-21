# Installation

##### Install [PM2](https://pm2.keymetrics.io/)

##### Install NVM

##### Install Mysql Server

##### Create log directory

```
mkdir /var/log/league
```

##### Setup crontab

```
wget https://raw.githubusercontent.com/mistakia/league/master/server/crontab -O crontab.txt
crontab ./crontab.txt
```

##### Clone repo

```
git clone https://github.com/mistakia/league.git
cd league
```

##### Import DB Schema

##### Create `config.production.js` using [`config.sample.js`](https://github.com/mistakia/league/blob/master/config.sample.js).

##### Install dependencies

```
yarn install
```

##### Start server

```
pm2 start ecosystem.config.js --env production
```

> Edit [`ecosystem.config.js`](https://github.com/mistakia/league/blob/master/ecosystem.config.js) to enable `yarn deploy` on local machine.
