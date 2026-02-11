firebase-sync.js:305 ❌ Erreur token pour écriture: Error: set failed: value argument  contains an invalid key (Santé/Pharma) in property 'users.BFtDpNd2oJgtzOEnEaT70tDmIBJ3.budgets.2024.Essentiel'.  Keys must be non-empty strings and can't contain ".", "#", "$", "/", "[", or "]"
    at validation.ts:173:17
    at be (util.ts:368:7)
    at ki (validation.ts:167:5)
    at validation.ts:186:7
    at be (util.ts:368:7)
    at ki (validation.ts:167:5)
    at validation.ts:186:7
    at be (util.ts:368:7)
    at ki (validation.ts:167:5)
    at validation.ts:186:7
(anonyme) @ firebase-sync.js:305Comprendre cette erreur
firebase-sync.js:229 ❌ Erreur listener Firebase: Error: permission_denied at /users/BFtDpNd2oJgtzOEnEaT70tDmIBJ3: Client doesn't have permission to access the desired data.
    at util.ts:485:17
    at onComplete (SyncTree.ts:804:23)
    at Object.onComplete (Repo.ts:317:24)
    at gt.onListenRevoked_ (PersistentConnection.ts:962:14)
    at gt.onDataPush_ (PersistentConnection.ts:677:12)
    at gt.onDataMessage_ (PersistentConnection.ts:656:12)
    at Ke.onDataMessage_ (Connection.ts:321:10)
    at Ke.onPrimaryMessageReceived_ (Connection.ts:313:12)
    at Qe.onMessage (Connection.ts:210:16)
    at Qe.appendFrame_ (WebSocketConnection.ts:300:12)
