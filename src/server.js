"use strict";

const restify = require('restify');
const app = restify.createServer();
const PORT = process.env.PORT || 8080;
const request = require('request');
const cheerio = require('cheerio');
const fs = require('fs');
const path = require('path');
const db = require('./lib/db');

app.use(restify.queryParser());
app.use(restify.bodyParser());

app.get('/wwe/superstars', (req, res, next) => {
  let base = 'http://www.wwe.com';
  request(`${base}/api/superstars`, (err, response, body) => {
    body = JSON.parse(body);

    let superstars = [];
    for(let index in body.talent) {
      let talent = body.talent[index];

      let superstar = {
        name: talent.name,
        slug: talent.link.replace('/superstars/', ''),
        tier: 0,
        active: 1,
        show: 0
      };

      for(let i in talent.filters) {
        let filter = talent.filters[i];
        let show = showId(filter);
        if (!show) continue;

        superstar.show = show;
        break;
      }

      // if no show, must be alumni/hof/inactive
      if (superstar.show < 1) superstar.active = 0;

      superstars.push(bio(`${base}${talent.link}`, superstar));
    }

    Promise.all(superstars).then(bios => {
      let insert = [];

      for(let i in bios) {
        let superstar = bios[i];

        insert.push([
          superstar.name,
          superstar.slug,
          superstar.tier,
          superstar.active,
          superstar.show,
          superstar.image,
          superstar.bio
        ]);
      }

      let query = 'INSERT INTO talent (`name`, slug, tier, active, `show`, image, bio) VALUES ?';
      db.query(query, [insert], (err, results, fields) => {
        if (err) throw err;
         res.send(results);
      });
    });
  });

  function bio(url, superstar) {
    return new Promise((resolve, reject) => {
      request(url, (err, res, body) => {
        let $ = cheerio.load(body);

        superstar.image = null;
        superstar.bio = $('.wwe-talent__bio-biography p').text() || null;
        let image = $('.wwe-talent__stats-images img').attr('src');

        // discontinue if we can't find an image
        if (!image || !image.length) return resolve(superstar);

        let meta = path.parse(image);
        let dest = path.join(__dirname, '..', 'assets', 'wwe', 'superstars', meta.base);

        superstar.image = meta.base;

        request(`${base}${image}`)
          .pipe(fs.createWriteStream(dest))
          .on('close', () => {
            resolve(superstar);
          });
      });
    }); 
  }

  // going inline instead of db lookup
  function showId(filter) {
    switch(parseInt(filter)) {
      case 40001050:
        return 1; // raw
      break;

      case 40001051:
        return 2; // smackdown
      break;

      case 13526876:
        return 3; // nxt
      break;

      case 40002158:
        return 4; // 205 live
      break;

      default:
        return false;
    }
  }
});

app.listen(PORT, () => {
    console.log('%s listening at %s', app.name, app.url);
});