//##: Set app configuration in the node env
process.env.cgsbAppTitle = "mydomain.io";
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
process.env.cgsbCollectionScripts = "scripts";
process.env.cgsbCollectionShownotes = "shownotes";
process.env.cgsbCollectionShortnames = "shortnames";
process.env.cgsbSystemFQDN = "http://localhost:3000";

process.env.cgsbSecurityCookieParserKey = "<changethisvalue>";
process.env.cgsbSecurityCookieSessionKey = "<changethisvalue>";
process.env.cgsbEmailServer = "smtp.gmail.com";
process.env.cgsbEmailUsername = "johndoe@gmail.com";
process.env.cgsbEmailPassword = "<changethisvalue>";

process.env.cgsbAWSBucketKey = '<changethisvalue>';
process.env.cgsbAWSBucketSecret = '<changethisvalue>';
process.env.cgsbAWSBucketDomain = 'mydomain.io';
process.env.cgsbAWSBucketTest = '<nameoftestbucket>';