<?php
/* ---------------------------------------------------------------------------
   db.config.sample.php: copy this file to db.config.php (same folder) and fill
   in your own values. db.config.php holds the database password, so it is
   listed in .gitignore and must never be committed. Keep this sample free of
   real values: it IS committed.
--------------------------------------------------------------------------- */

return [

    /* The MySQL database, as hPanel shows it under Databases -> Management.
       Hostinger prefixes both the name and the user with your account id:
       copy them whole, prefix included.

       host: 'localhost' when the ERP runs on Hostinger itself. To reach the
       same database from your own computer, add your IP in hPanel ->
       Databases -> Remote MySQL and use the host name shown there instead. */
    'host' => 'localhost',
    'name' => 'u000000000_erp',
    'user' => 'u000000000_erp',
    'pass' => 'PUT-THE-DATABASE-PASSWORD-HERE',

    /* Where the ERP is served from, exactly as it appears in the address bar
       (https, no trailing slash). A request from any other address is turned
       away, so another site can't drive this API with someone's session.
       Give a list to allow more than one, e.g.
       ['https://erp.example.com', 'http://localhost:8000']. */
    'origin' => 'https://erp.example.com',
];
