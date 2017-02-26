const mysql = require('mysql');

let connection = mysql.createConnection({
    user     : process.env.PWFDB_USER,
    password : process.env.PWFDB_PASS,
    database : 'pwfantasy'
});

connection.connect(function(err) {
    if (err) throw err;
});

module.exports = connection;