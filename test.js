const config = require('./config/config');
const request = require('request');
const fs = require('fs');
const clearModule = require('clear-module');
//const Binance       = require('node-binance-api');
const EMA = require('technicalindicators').EMA;
const BB = require('technicalindicators').BollingerBands;
const timeRequest = config.intervalRequest;
const port = config.requestPort;
const par = config.pair;
const interval = config.intervalTime;
const limit = config.requestLimit;
const api = config.apiKey;
const secret = config.apiSecret;
const resolution = config.resolution;
var requests = 0;

const binance = require('node-binance-api')().options({
    APIKEY: api,
    APISECRET: secret,
    useServerTime: true
});

binance.websockets.chart("BTCUSDT", interval, (symbol, interval, chart) => {
    clearModule('./var/lastOrder');
    const tempFile = require('./var/lastOrder');
    var consoles = '\033c\x1b[37m Bem Vindo ao Rattsus - Binance (Test)\n numero de requisições: ' + requests++;
    console.log(
        '\x1b[36m ############################################################################# \n' +
        consoles + '\n' +
        '\x1b[36m #############################################################################'
    );

    var x, time;
    let myChart = Object.values(chart);
    time = new Date().getTime();
    let o, c, v, h, l, t, lets;
    for (x = 0; x < myChart.length; x++) {
        o += (myChart[x].open) + ', ';
        c += (myChart[x].close) + ', ';
        v += (myChart[x].volume) + ', ';
        h += (myChart[x].high) + ', ';
        l += (myChart[x].low) + ', ';
        t += (time) + ', ';
    }
    let chartData = {
        o: [o],
        c: [c],
        v: [v],
        h: [h],
        l: [l],
        t: [t],
        s: 'ok'
    }

    let body = chartData;
    open = JSON.stringify(body.o[0])
    open = open.substring(1, (open.length - 3))
    open = open.split(',').map(Number)

    close = JSON.stringify(body.c[0])
    close = close.substring(1, (close.length - 3))
    close = close.split(',').map(Number)

    high = JSON.stringify(body.h[0])
    high = high.substring(1, (high.length - 3))
    high = high.split(',').map(Number)

    low = JSON.stringify(body.l[0])
    low = low.substring(1, (low.length - 3))
    low = low.split(',').map(Number)

    volume = JSON.stringify(body.v[0])
    volume = volume.substring(1, (volume.length - 3))
    volume = volume.split(',').map(Number)

    timeStamp = JSON.stringify(body.t[0])
    timeStamp = timeStamp.substring(1, (time.length - 3))
    timeStamp = timeStamp.split(',').map(Number)

    var candleData = {
        "o": open,
        "c": close,
        "v": volume,
        "h": high,
        "l": low,
        //"t": timeStamp,
        "s": "ok"
    }
    candleData = JSON.stringify(candleData)
    candleData = JSON.parse(candleData)
    //console.log(candleData.o[1]);


    let ME = EMA.calculate({ period: config.EMA, values: candleData.c });
    let BANDS = BB.calculate({ period: config.BB.period, stdDev: config.BB.stdDev, values: candleData.c });

    let MeVerse = ME.slice(-1)[0];
    let BBVerse = BANDS.slice(-1)[0];
    let valueClose = candleData.c.slice(-1)[0];

    function cross(BBup, BBdown, EMA) {
        if (valueClose >= BBup && valueClose < EMA) {
            return 2; //sell
        }
        if (valueClose <= BBdown && valueClose > EMA) {
            return 1; //buy
        }
        return 0;
    }

    binance.balance((err, balances) => {
        if (err) {
            console.log('Balance Error -> ' + err)
        } else {
            binance.exchangeInfo((err, data) => {
                if (err) {
                    console.log('exchangeInfo error -> ' + err)
                }
                let minimums = {};
                try {
                    for (let obj of data.symbols) {
                        let filters = { status: obj.status };
                        for (let filter of obj.filters) {
                            if (filter.filterType == "MIN_NOTIONAL") {
                                filters.minNotional = filter.minNotional;
                            } else if (filter.filterType == "PRICE_FILTER") {
                                filters.minPrice = filter.minPrice;
                                filters.maxPrice = filter.maxPrice;
                                filters.tickSize = filter.tickSize;
                            } else if (filter.filterType == "LOT_SIZE") {
                                filters.stepSize = filter.stepSize;
                                filters.minQty = filter.minQty;
                                filters.maxQty = filter.maxQty;
                            }
                        }
                        try {
                            filters.orderTypes = obj.orderTypes;
                            filters.icebergAllowed = obj.icebergAllowed;
                            minimums[obj.symbol] = filters;
                        } catch (error) {
                            console.log('Conditional Error -> ' + error)
                        }
                    }
                } catch (error) {
                    console.log('Glogal Error -> ' + error)
                }
                try {

                    global.filters = minimums; let minQty = minimums.BTCUSDT.minQty;
                    let minNotional = minimums.BTCUSDT.minNotional;
                    let stepSize = minimums.BTCUSDT.stepSize;
                    let priceOrder = candleData.c.slice(-1)[0];
                    let walletBTC = balances.BTC.available / 1;
                    let walletUSDT = balances.USDT.available / 1;


                    walletBTC = walletBTC.toFixed(6);
                    walletUSDT = walletUSDT.toFixed(6);
                    let amountBuy = walletUSDT / priceOrder;
                    let amountSell = walletBTC / 1;
                    //buy
                    if (amountBuy < minQty) {
                        amountBuy = minQty;
                    }

                    if (priceOrder * amountBuy < minNotional) {
                        amountBuy = minNotional / priceOrder;
                    }
                    //sell
                    if (amountSell < minQty) {
                        amountSell = minQty;
                    }

                    if (priceOrder * amountSell < minNotional) {
                        amountSell = minNotional / priceOrder;
                    }

                    amountBuy = binance.roundStep(amountBuy, stepSize) - 0.000001
                    amountSell = binance.roundStep(amountSell, stepSize) - 0.000001
                    amountCalcBuy = priceOrder * amountBuy;
                    amountCalcSell = priceOrder * amountSell;
                    amountBuy = amountBuy.toFixed(6)
                    amountSell = amountSell.toFixed(6)

                    //##############################################################################################################################
                    //##############################################################################################################################

                    if (cross(BBVerse.upper, BBVerse.lower, MeVerse) == 1) {
                        console.log('\x1b[32m Function Side -> Buy')
                    }
                    if (cross(BBVerse.upper, BBVerse.lower, MeVerse) == 2) {
                        console.log('\x1b[31m Function Side -> Sell')
                    }
                    if (cross(BBVerse.upper, BBVerse.lower, MeVerse) == 0) {
                        console.log('\x1b[36m Function Side -> StandBy')
                    }

                    console.log('### ' + amountCalcBuy + ' ' + amountCalcSell + ' ### ' + minNotional + ' ### ' + minQty)
                    console.log('|----------------configurações------------------------------------')
                    console.log('\n \x1b[33m preço atual de mercado: ' + priceOrder + '\n -------------------------------------------')
                    console.log('\n \x1b[33m Par negociado: ' + config.pair + '\n -------------------------------------------')
                    console.log('\n \x1b[33m intervalo de requisição: ' + (config.intervalRequest / 1000) + ' Segundos\n -------------------------------------------')
                    console.log('\n \x1b[33m Saldo BTC: ' + walletBTC + '\n -------------------------------------------')
                    console.log('\n \x1b[33m Saldo USDT ' + walletUSDT + '\n -------------------------------------------')
                    console.log('\n \x1b[33m Ultima Ordem: ' + tempFile.type + '\n -------------------------------------------')
                    console.log('\n \x1b[33m amountBuy Valor ' + amountBuy + '\n -------------------------------------------')
                    console.log('\n \x1b[33m amountSell Valor ' + amountSell + '\n -------------------------------------------')
                    console.log('\x1b[37m BB Value -> ' + BBVerse.middle + ' - ' + BBVerse.upper + ' - ' + BBVerse.lower + ' || ' + config.BB.period + ' and ' + config.BB.stdDev);
                    console.log('\n \x1b[33m valor de fechamento:' + valueClose + ' \n -------------------------------------------')

                    console.log('\n \x1b[33m Execução de funções: compra & venda \n -------------------------------------------')

                    //#####################################################################################################################################################
                    //#####################################################################################################################################################
                    function buy(pair, volume) {
                        binance.marketBuy(pair, volume, (err, response) => {
                            if (err) {
                                console.log('erro ao comprar')
                                console.log(JSON.stringify(err))
                            } else {
                                console.log("Market Buy response", response);
                                console.log("order id: " + response.orderId);
                                var createTemp = "var lastOrder = {type: 'buy'}; module.exports = lastOrder;"
                                fs.writeFile('./var/lastOrder.js', createTemp, (err) => {
                                    if (err) {
                                        console.log(err)
                                    } else {
                                        console.log('criado arquivo temporario -> Buy')
                                    }
                                })
                            }
                        });
                    }

                    function sell(pair, volume) {
                        binance.marketSell(pair, volume, (err, response) => {
                            if (err) {
                                console.log('erro ao vender')
                                console.log(JSON.stringify(err))
                            } else {
                                console.log("Market sell response", response);
                                console.log("order id: " + response.orderId);
                                var createTemp = "var lastOrder = {type: 'sell'}; module.exports = lastOrder;"
                                fs.writeFile('./var/lastOrder.js', createTemp, (err) => {
                                    if (err) {
                                        console.log(err)
                                    } else {
                                        console.log('criado arquivo temporario -> Buy')
                                    }
                                })
                            }
                        });
                    }

                    if (cross(BBVerse.upper, BBVerse.lower, MeVerse) == 1) {
                        if (tempFile.type == 'sell') {
                            console.log('executando compra...')
                            buy(par, amountBuy)
                        } else {
                            console.log('compra lançada, aguardando venda...')
                        }
                    } else {
                        console.log('aguardando cruzamentos...');
                    }

                    if (cross(BBVerse.upper, BBVerse.lower, MeVerse) == 2) {
                        if (tempFile.type == 'buy') {
                            console.log('executando venda...')
                            sell(par, amountSell)
                        } else {
                            console.log('venda lançada, aguardando compra...')
                        }
                    } else {
                        console.log('aguardando cruzamentos...');
                    }
                } catch (error) {
                    console.log('Fatal Error -> ' + error)
                }
            })
        }
    })

    //console.log(BBVerse)
});