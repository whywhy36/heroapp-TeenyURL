var expect = require("expect.js"),
    idgen = require("idgen"),
    services = require("../app/lib/ServiceBinding"),
    PersistentDbWrapper = require("../app/lib/PersistentDbWrapper"),
    duplicationFilter = require("../app/lib/PostgresDuplicationFilter"),
    th = require("./helpers");

var keyGen = function generate_key(dataObject, callback){
    callback(null, idgen());
};

th.when(services.postgres)
  .describe("PostgresDataAccessor.Functional", function () {
    var ORIGINURL_PREFIX = "http://docs.cloudfoundry.com/";
    var postgresAccessor;

    before(function () {
        var connInfo = services.postgres;
        expect(connInfo).to.not.be(null);
        postgresAccessor = new PersistentDbWrapper.DataAccessor(PersistentDbWrapper.buildConn(connInfo, 'postgres'), duplicationFilter);
    });

    it("#return 'undefine' with not-exist key", function (done) {
        postgresAccessor.fetch("noneExistKey", th.asyncExpect(function (err, fetchResult) {
            expect(fetchResult).to.not.be.ok();
        }, done));
    });

    it("#create and fetch short URL", function (done) {
        // Use idgen to generate a random url.
        var originalUrl = ORIGINURL_PREFIX + idgen();
        var EXPIRE_IN = 1000; //unit is ms
        var expireAtDate = new Date(Date.now() + EXPIRE_IN);
        var dataObject =  { originalUrl : originalUrl, expireAt : expireAtDate };
        postgresAccessor.create(dataObject, keyGen, th.asyncExpect(function (err, createResult) {
            expect(err).to.be(null);
            expect(createResult).to.have.property("key");
            expect(createResult.key).to.not.be.empty();
            postgresAccessor.fetch(createResult.key, th.asyncExpect(function (err, fetchResult) {
                expect(err).to.be(null);
                expect(fetchResult).to.not.be(null);
                expect(fetchResult).to.have.property("originalUrl");
                expect(fetchResult.originalUrl).to.eql(originalUrl);
                setTimeout(function () {
                    postgresAccessor.fetch(createResult.key, th.asyncExpect(function (err, fetchResult) {
                    expect(err).to.be(null);
                    // should expire now
                    expect(fetchResult).to.not.be.ok();
                    var dataObjectNotExpire =  { originalUrl : originalUrl };
                    postgresAccessor.create(dataObjectNotExpire, keyGen, th.asyncExpect(function (err, createResult2) {
                        // should be able to overwrite the expire Date
                        expect(err).to.be(null);
                        expect(createResult2.key).to.not.be.empty();
                        // We re-activate the expired mapping, so the same key should return
                        expect(createResult2.key).to.eql(createResult.key);
                        postgresAccessor.fetch(createResult2.key, th.asyncExpect(function (err, fetchResult) {
                            //console.log("test go here");
                            expect(err).to.be(null);
                            expect(fetchResult).to.have.property("originalUrl");
                            expect(fetchResult.originalUrl).to.eql(originalUrl);
                        }, done));
                    }, done, true));
                }, done, true));
               }, EXPIRE_IN + 200);
            }, done, true));
        }, done, true));
    });
});
