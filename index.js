require('dotenv').config();
const h = require('highland');
const yaml = require('js-yaml');

const Poloniex = require('poloniex-api-node');
const Kraken = require('kraken-exchange-api');

function poloniex(key, secret) {
  let p = new Poloniex(key, secret);

  return function (method = 'returnCompleteBalances', params = null) {
    return new Promise((resolve, reject) => {
      p[method](params, (err, res) => {
        if (err) {
          reject(err);
        } else {
          resolve(res);
        }
      });
    });
  };
}

function getPoloniexBalance({key, secret}) {
  const polo = poloniex(key, secret);
  return h(polo('returnCompleteBalances'))
      .flatMap(h.pairs)
      .map(
          (x) =>
              ({id: x[0], amount: +x[1].available, amount_btc: +x[1].btcValue}))
      .reject(({amount_btc}) => +amount_btc === 0);
}

function kraken(key, secret) {
  let k = new Kraken(key, secret);

  return function (method = 'Balance', params = null) {
    return new Promise((resolve, reject) => {
      k.api(method, params, (error, data) => {
        if (error) {
          reject(error);
        } else if (data.error && data.error.length) {
          reject(data.error);
        } else {
          resolve(data.result);
        }
      });
    });
  }
}

function getKrakenBalance({key, secret}) {
  const k = kraken(key, secret);
  
  /**
   * @param {string} from 
   * @param {string} to 
   * @returns {Stream}
   */
  function getPrice(from, to) {
    const pair = `${from}${to}`
    const nice_to = to.slice(1).toLowerCase();
    return h(k('Ticker', {pair}))
      .map((x) =>
        [`amount_${nice_to}`, +x[pair].c[0]] // c = last trade, 0 = price
      )
      .errors((err, push) => {
        // h.log(`error for ${pair}`, err)
        push(null, null)
      })
  }

  return h(k('Balance'))
    .flatMap((h.pairs))
    .reject(([id, amount]) => +amount === 0)
    .flatMap(([id, amount]) =>
        h([getPrice(id, `ZEUR`), getPrice(id, `XXBT`)])
        .flatMap(x => x)
        .filter(x => x)
        .reduce({id, amount: +amount}, (result, [key, val]) => {
          if (val) { result[key] = val; }
          return result;
        })
    )
}

const e = process.env;
const polos = getPoloniexBalance({key: e.POLONIEX_KEY, secret: e.POLONIEX_SECRET})
const kraks = getKrakenBalance({key: e.KRAKEN_KEY, secret: e.KRAKEN_SECRET})

polos.toArray((p) => {
  kraks.toArray((k) => {
    console.log(yaml.safeDump([{
      date: new Date(),
      kraken: {
        currency: k,
      },
      poloniex: {
        currency: p,
      },
    }]))
  })
})