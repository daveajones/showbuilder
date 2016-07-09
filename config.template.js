//##: Set app configuration in the node env
process.env.cgsbAppTitle = "ShowBuilder.io";
process.env.cgsbDatabaseName = "showBuilder";
process.env.cgsbDatabaseHost = "localhost";
process.env.cgsbDatabasePort = "27017";
process.env.cgsbCollectionUsers = "users";
process.env.cgsbCollectionTokens = "tokens";
process.env.cgsbCollectionRegister = "register";
process.env.cgsbCollectionShows = "shows";
process.env.cgsbCollectionEpisodes = "episodes";
process.env.cgsbCollectionAccounts = "accounts";
process.env.cgsbCollectionOptions = "options";
process.env.cgsbCollectionServices = "services";
process.env.cgsbSystemFQDN = "http://localhost:3000";

process.env.cgsbSecurityCookieParserKey = "<changethisvalue>";
process.env.cgsbSecurityCookieSessionKey = "<changethisvalue>";
process.env.cgsbEmailServer = "smtp.gmail.com";
process.env.cgsbEmailUsername = "johndoe@gmail.com";
process.env.cgsbEmailPassword = "12oi$$mp4tQ#fu66lHi3q8DF9cp!";