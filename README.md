# Blast Contract Inspector

https://gasclaim.coolhd.hu

A web application that allows users to inspect Blast protocol contracts, displaying yield configurations, gas parameters, and claimable yields with both ETH and USD values.

## Features

- Check any Blast contract by entering its address
- Display yield configuration mode (Automatic/Void/Claimable)
- Show gas parameters including:
  - Current Ether balance (with USD equivalent)
  - Last update timestamp
  - Claimable matured gas (with USD equivalent)
  - Gas mode (Void/Claimable)
- Display claimable yield amount (with USD equivalent)
- Real-time ETH/USD price conversion using CoinGecko API

## 1. Installation

```
bash
git clone [repository-url]
cd Blast-gas-claim
```

## 2. Start the application
### Start with docker
```
docker compose up
```

### Start with npm
```
npm install http-server
npx http-server -a localhost -p 9998 -o src/
```

### Start with python
```
cd src && python -m http.server 9998
```
