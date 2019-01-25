/* eslint-disable no-undef,prefer-arrow-callback */
const chai = require('chai');
const chaiAsPromised = require('chai-as-promised');
const { join } = require('path');
const { readFileSync } = require('fs');
const { configure } = require('../.');
const ProxyLists = require('proxy-lists');

chai.use(chaiAsPromised);

const expect = chai.expect;
const results = JSON.parse(readFileSync(join(__dirname, 'results.json')));

const list = () => {
  return new Promise((resolve) => {
    const options = {
      countries: ['br'],
      sourcesWhiteList: ['hidemyname'],
      // sourcesWhiteList: ['freeproxylist', 'gatherproxy', 'incloak', 'premproxy', 'proxydb'],
      sourcesBlackList: ['bitproxies', 'kingproxies'],
    };

    let proxies = [];

    const listing = ProxyLists.getProxies(options);

    listing.on('data', (fresh) => {
      proxies = [...proxies, ...fresh];
    });

    listing.on('error', (error) => {
      // console.error(error);
    });

    listing.once('end', () => {
      resolve(proxies);
    });
  });
};

describe('search', function () {

  let search;

  it('Configure', async function() {
    this.timeout(300000);

    const proxies = await list();
    const proxy = proxies[Math.floor(Math.random() * proxies.length)];

    search = configure({
      timeout: 0,
      host: 'cidadao.sinesp.gov.br',
      endpoint: '/sinesp-cidadao/mobile/consultar-placa/',
      serviceVersion: 'v4',
      androidVersion: '8.1.0',
      secret: 'g8LzUadkEHs7mbRqbX5l',
      maximumRetry: 3,
      proxy: {
        host: proxy.ipAddress,
        port: proxy.port,
      }
    }).search;

    return expect(search).to.be.not.null;
  });

  /** Success tests * */
  Object.keys(results).forEach(function (plate) {
    it(`Success: ${plate}`, async function () {
      this.timeout(300000);
      this.retries(4);
      const vehicle = await search(plate);

      return expect(vehicle)
        .to.deep.include(results[plate])
        .to.contain.keys('data', 'dataAtualizacaoAlarme', 'dataAtualizacaoRouboFurto', 'dataAtualizacaoCaracteristicasVeiculo');
    });
  });

  it('Fail: no parameter provided', async () => expect(search()).to.be.rejectedWith('Formato de placa inválido! Utilize o formato "AAA9999" ou "AAA-9999".'));
  it('Fail: empty plate', async () => expect(search('')).to.be.rejectedWith('Formato de placa inválido! Utilize o formato "AAA9999" ou "AAA-9999".'));
  it('Fail: bad format', async () => expect(search('AAAAAAA')).to.be.rejectedWith('Formato de placa inválido! Utilize o formato "AAA9999" ou "AAA-9999".'));

  it('Fail: not found', async function () {
    this.timeout(300000);
    this.retries(4);

    return expect(search('ZZZ9999')).to.be.rejectedWith('Veículo não encontrado');
  });

  it('Fail: Wrong URL', async function() {
    this.timeout(300000);

    const { search } = configure({
      endpoint: '/sinesp-cidadao/mobile/errado-consultar-placa/',
      maximumRetry: 3,
      proxy: {},
    });

    return expect(search('ZZZ9999')).to.be.rejected;
  });
});
