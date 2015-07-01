var path = require('path'),
    should = require('should'),
    MDS = require('mds-wrapper'),
    Config = require('bs-builder-core/lib/config'),
    Model = require('bs-builder-core/lib/model/model'),
    LibrariesSynMDS = require('../../lib/tasks/libraries-sync-mds');

describe('LibrariesSynMDS', function () {
    it('should return valid task name', function () {
        LibrariesSynMDS.getName().should.equal('synchronize libraries data with remote mds storage');
    });

    describe('constructor', function () {
        var config;

        beforeEach(function () {
            config = new Config('debug');
        });

        it('should throw error if mds options were not set', function () {
            (function () {
                return new LibrariesSynMDS(config, {})
            }).should.throw('MDS options were not set in task configuration');
        });

        it('should throw error if mds namespace option was not set', function () {
            (function () {
                return new LibrariesSynMDS(config, { mds: {} })
            }).should.throw('MDS "namespace" property was not set in task configuration');
        });

        it('should set default mds host parameter if it was not set in configuration', function () {
            var task = new LibrariesSynMDS(config, { mds: { namespace: 'mysite' } });
            task.getTaskConfig().mds.host.should.equal('127.0.0.1');
        });

        it('should set default mds port parameter if it was not set in configuration', function () {
            var task = new LibrariesSynMDS(config, {
                mds: {
                    namespace: 'mysite',
                    host: 'storage.mds.net'
                }
            });
            task.getTaskConfig().mds.port.should.equal(80);
        });

        it('should set valid mds configuration after task initialization', function () {
            var mdsOptions = {
                    namespace: 'mysite',
                    host: 'storage.mds.net',
                    port: 80
                },
                task = new LibrariesSynMDS(config, { mds: mdsOptions });

            task.api.should.be.instanceOf(MDS);
        });
    });

    describe('instance methods', function () {
        var config, task;

        beforeEach(function () {
            config = new Config('debug');
            task = new LibrariesSynMDS(config, {
                mds: {
                    namespace: 'mysite',
                    host: 'storage.mds.net',
                    port: 80
                },
                baseUrl: '/libraries'
            });
        });

        describe('_getLibrariesCachePath', function () {
            it('should get valid libraries cache path with given "baseUrl"', function () {
                task._getLibrariesCachePath()
                    .should.equal(path.join(task.getBaseConfig().getCacheFolder(), 'libraries'));
            });

            it('should get valid libraries cache path with default "baseUrl"', function () {
                task.getTaskConfig().baseUrl = undefined;
                task._getLibrariesCachePath()
                    .should.equal(path.join(task.getBaseConfig().getCacheFolder(), 'libs'));
            });
        });

        describe('_getMDSRegistryFilePath', function () {
            it('should return valid path to MDS registry file in cache', function () {
                task._getMDSRegistryFilePath()
                    .should.equal(path.join(task.getBaseConfig().getCacheFolder(), 'libraries/registry.json'));
            });
        });

        describe('_getLibVersionPath', function () {
            it('should return valid library version path in cache', function () {
                task._getLibVersionPath('bem-core', 'v1.0.0')
                    .should.equal(path.join(task.getBaseConfig().getCacheFolder(), 'libraries/bem-core/v1.0.0'));
            });
        });
    });
});
