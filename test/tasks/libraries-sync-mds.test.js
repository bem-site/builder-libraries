var path = require('path'),
    should = require('should'),
    MDS = require('mds-wrapper'),
    fsExtra = require('fs-extra'),
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

            fsExtra.mkdirsSync(task.getBaseConfig().getCacheFolder());
        });

        afterEach(function () {
            fsExtra.removeSync(task.getBaseConfig().getCacheFolder());
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

        describe('_getRegistryFromCache', function () {
            it('should read registry from cache', function () {
                var p1 = path.join(task.getBaseConfig().getCacheFolder(), './libraries'),
                    p2 = path.join(process.cwd(), './test/fixtures/registry.json');
                fsExtra.ensureDirSync(p1);
                fsExtra.copySync(p2, path.join(p1, 'registry.json'));

                return task._getRegistryFromCache().then(function (result) {
                    should.deepEqual(result, fsExtra.readJSONSync(p2));
                });
            });

            it('should return empty registry if file does not exist in cache', function () {
                var p1 = path.join(task.getBaseConfig().getCacheFolder(), './libraries');
                fsExtra.ensureDirSync(p1);

                return task._getRegistryFromCache().then(function (result) {
                    should.deepEqual(result, {});
                });
            });
        });

        describe('_createComparatorMap', function () {
            it('should create comparator map', function () {
                var registryFilePath = path.join(process.cwd(), './test/fixtures/registry.json'),
                    registry = fsExtra.readJSONSync(registryFilePath),
                    comparatorMap = task._createComparatorMap(registry);

                comparatorMap.get('bem-core||v2').should.be.instanceOf(Object);
                should.deepEqual(comparatorMap.get('bem-core||v2'), {
                    sha: 'a25b147f254ee8e46c26031886f243221dc3d35f',
                    date: 1432047899246
                });

                comparatorMap.get('bem-bl||dev').should.be.instanceOf(Object);
                should.deepEqual(comparatorMap.get('bem-bl||dev'), {
                    sha: '3b7998cc3be75d7ef3235e5fce2f61c4637921bd',
                    date: 1423135691152
                });
            });
        });

        describe('_compareRegistryFiles', function () {
            var model,
                remote;

            beforeEach(function () {
                var registryFilePath = path.join(process.cwd(), './test/fixtures/registry.json');
                remote = fsExtra.readJSONSync(registryFilePath);
                model = new Model();
            });

            it('should return valid result structure', function () {
                var local = JSON.parse(JSON.stringify(remote)),
                    result = task._compareRegistryFiles(model, local, remote);

                result.should.be.instanceOf(Object);

                result.should.have.property('added');
                result.should.have.property('modified');
                result.should.have.property('removed');

                result.added.should.be.instanceOf(Array);
                result.modified.should.be.instanceOf(Array);
                result.removed.should.be.instanceOf(Array);
            });

            it('nothing changed. registry files are equal', function () {
                var local = JSON.parse(JSON.stringify(remote)),
                    result = task._compareRegistryFiles(model, local, remote);

                result.modified.should.have.length(0);
                result.removed.should.have.length(0);
                result.added.should.have.length(0);

                model.getChanges().pages.added.should.have.length(0);
                model.getChanges().pages.modified.should.have.length(0);
                model.getChanges().pages.removed.should.have.length(0);
            });

            it('library was added', function () {
                var local = JSON.parse(JSON.stringify(remote));
                delete  local['bem-bl'];

                var result = task._compareRegistryFiles(model, local, remote);

                result.modified.should.have.length(0);
                result.removed.should.have.length(0);
                result.added.should.have.length(1);
                should.deepEqual(result.added, [{ lib: 'bem-bl', version: 'dev' }]);

                model.getChanges().pages.added.should.have.length(1);
                should.deepEqual(model.getChanges().pages.added, [{ lib: 'bem-bl', version: 'dev' }]);
            });

            it('library version was added', function () {
                var local = JSON.parse(JSON.stringify(remote));
                delete  local['bem-core' ].versions['v2'];

                var result = task._compareRegistryFiles(model, local, remote);

                result.modified.should.have.length(0);
                result.removed.should.have.length(0);
                result.added.should.have.length(1);
                should.deepEqual(result.added, [{ lib: 'bem-core', version: 'v2' }]);

                model.getChanges().pages.added.should.have.length(1);
                should.deepEqual(model.getChanges().pages.added, [{ lib: 'bem-core', version: 'v2' }]);
            });

            it('library versions were added (several versions for one library)', function () {
                var local = JSON.parse(JSON.stringify(remote));
                delete  local['bem-core' ].versions['v2'];
                delete  local['bem-core' ].versions['v2.5.1'];
                delete  local['bem-core' ].versions['v2.6.0'];

                var result = task._compareRegistryFiles(model, local, remote);

                result.modified.should.have.length(0);
                result.removed.should.have.length(0);
                result.added.should.have.length(3);
                should.deepEqual(result.added, [
                    { lib: 'bem-core', version: 'v2' },
                    { lib: 'bem-core', version: 'v2.5.1' },
                    { lib: 'bem-core', version: 'v2.6.0' }
                ]);

                model.getChanges().pages.added.should.have.length(3);
                should.deepEqual(model.getChanges().pages.added, [
                    { lib: 'bem-core', version: 'v2' },
                    { lib: 'bem-core', version: 'v2.5.1' },
                    { lib: 'bem-core', version: 'v2.6.0' }
                ]);
            });

            it('libraries versions were added (for different libraries)', function () {
                var local = JSON.parse(JSON.stringify(remote));
                delete  local['bem-core' ].versions['v2'];
                delete  local['bem-components' ].versions['v2'];

                var result = task._compareRegistryFiles(model, local, remote);

                result.modified.should.have.length(0);
                result.removed.should.have.length(0);
                result.added.should.have.length(2);
                should.deepEqual(result.added, [
                    { lib: 'bem-core', version: 'v2' },
                    { lib: 'bem-components', version: 'v2' }
                ]);

                model.getChanges().pages.added.should.have.length(2);
                should.deepEqual(model.getChanges().pages.added, [
                    { lib: 'bem-core', version: 'v2' },
                    { lib: 'bem-components', version: 'v2' }
                ]);
            });

            it('library was removed', function () {
                var local = JSON.parse(JSON.stringify(remote));
                delete  remote['bem-bl'];

                var result = task._compareRegistryFiles(model, local, remote);

                result.modified.should.have.length(0);
                result.removed.should.have.length(1);
                result.added.should.have.length(0);
                should.deepEqual(result.removed, [{ lib: 'bem-bl', version: 'dev' }]);

                model.getChanges().pages.removed.should.have.length(1);
                should.deepEqual(model.getChanges().pages.removed, [{ lib: 'bem-bl', version: 'dev' }]);
            });

            it('library version was removed', function () {
                var local = JSON.parse(JSON.stringify(remote));
                delete remote['bem-core' ].versions['v2'];

                var result = task._compareRegistryFiles(model, local, remote);

                result.modified.should.have.length(0);
                result.removed.should.have.length(1);
                result.added.should.have.length(0);
                should.deepEqual(result.removed, [{ lib: 'bem-core', version: 'v2' }]);

                model.getChanges().pages.removed.should.have.length(1);
                should.deepEqual(model.getChanges().pages.removed, [{ lib: 'bem-core', version: 'v2' }]);
            });

            it('library versions were removed (several versions for one library)', function () {
                var local = JSON.parse(JSON.stringify(remote));
                delete remote['bem-core' ].versions['v2'];
                delete remote['bem-core' ].versions['v2.5.1'];
                delete remote['bem-core' ].versions['v2.6.0'];

                var result = task._compareRegistryFiles(model, local, remote);

                result.modified.should.have.length(0);
                result.removed.should.have.length(3);
                result.added.should.have.length(0);
                should.deepEqual(result.removed, [
                    { lib: 'bem-core', version: 'v2' },
                    { lib: 'bem-core', version: 'v2.5.1' },
                    { lib: 'bem-core', version: 'v2.6.0' }
                ]);

                model.getChanges().pages.removed.should.have.length(3);
                should.deepEqual(model.getChanges().pages.removed, [
                    { lib: 'bem-core', version: 'v2' },
                    { lib: 'bem-core', version: 'v2.5.1' },
                    { lib: 'bem-core', version: 'v2.6.0' }
                ]);
            });

            it('libraries versions were removed (for different libraries)', function () {
                var local = JSON.parse(JSON.stringify(remote));
                delete remote['bem-core'].versions['v2'];
                delete remote['bem-components'].versions['v2'];

                var result = task._compareRegistryFiles(model, local, remote);

                result.modified.should.have.length(0);
                result.removed.should.have.length(2);
                result.added.should.have.length(0);
                should.deepEqual(result.removed, [
                    { lib: 'bem-core', version: 'v2' },
                    { lib: 'bem-components', version: 'v2' }
                ]);

                model.getChanges().pages.removed.should.have.length(2);
                should.deepEqual(model.getChanges().pages.removed, [
                    { lib: 'bem-core', version: 'v2' },
                    { lib: 'bem-components', version: 'v2' }
                ]);
            });

            it('library version was modified (by sha sum)', function () {
                var local = JSON.parse(JSON.stringify(remote));
                remote['bem-core'].versions['v2'].sha = 'a25b147f254ee8e46c26031886f243221dc3d35e';

                var result = task._compareRegistryFiles(model, local, remote);

                result.modified.should.have.length(1);
                result.removed.should.have.length(0);
                result.added.should.have.length(0);
                should.deepEqual(result.modified, [{ lib: 'bem-core', version: 'v2' }]);

                model.getChanges().pages.modified.should.have.length(1);
                should.deepEqual(model.getChanges().pages.modified, [{ lib: 'bem-core', version: 'v2' }]);
            });

            it('library version was modified (by date)', function () {
                var local = JSON.parse(JSON.stringify(remote));
                remote['bem-core'].versions['v2'].date = 1432047899247;

                var result = task._compareRegistryFiles(model, local, remote);

                result.modified.should.have.length(1);
                result.removed.should.have.length(0);
                result.added.should.have.length(0);
                should.deepEqual(result.modified, [{ lib: 'bem-core', version: 'v2' }]);

                model.getChanges().pages.modified.should.have.length(1);
                should.deepEqual(model.getChanges().pages.modified, [{ lib: 'bem-core', version: 'v2' }]);
            });

            it('library versions were modified (several versions for one library)', function () {
                var local = JSON.parse(JSON.stringify(remote));
                remote['bem-core'].versions['v2'].sha = 'a25b147f254ee8e46c26031886f243221dc3d35e';
                remote['bem-core'].versions['v2.5.1'].date = 1423135728312;
                remote['bem-core'].versions['v2.6.0'].date = 1432044935917;

                var result = task._compareRegistryFiles(model, local, remote);

                result.modified.should.have.length(3);
                result.removed.should.have.length(0);
                result.added.should.have.length(0);
                should.deepEqual(result.modified, [
                    { lib: 'bem-core', version: 'v2' },
                    { lib: 'bem-core', version: 'v2.5.1' },
                    { lib: 'bem-core', version: 'v2.6.0' }
                ]);

                model.getChanges().pages.modified.should.have.length(3);
                should.deepEqual(model.getChanges().pages.modified, [
                    { lib: 'bem-core', version: 'v2' },
                    { lib: 'bem-core', version: 'v2.5.1' },
                    { lib: 'bem-core', version: 'v2.6.0' }
                ]);
            });

            it('libraries versions were modified (for different libraries)', function () {
                var local = JSON.parse(JSON.stringify(remote));
                remote['bem-core'].versions['v2'].sha = 'a25b147f254ee8e46c26031886f243221dc3d35e';
                remote['bem-components'].versions['v2'].sha = '0fd242aa10d351405eda67ea3ae15074ad973bdc';

                var result = task._compareRegistryFiles(model, local, remote);

                result.modified.should.have.length(2);
                result.removed.should.have.length(0);
                result.added.should.have.length(0);
                should.deepEqual(result.modified, [
                    { lib: 'bem-core', version: 'v2' },
                    { lib: 'bem-components', version: 'v2' }
                ]);

                model.getChanges().pages.modified.should.have.length(2);
                should.deepEqual(model.getChanges().pages.modified, [
                    { lib: 'bem-core', version: 'v2' },
                    { lib: 'bem-components', version: 'v2' }
                ]);
            });

            it('complex case (added, removed and modified)', function () {
                var local = JSON.parse(JSON.stringify(remote));
                delete local['bem-bl'];
                delete remote['bem-core'].versions['v2'];
                remote['bem-components'].versions['v2'].sha = '0fd242aa10d351405eda67ea3ae15074ad973bdc';

                var result = task._compareRegistryFiles(model, local, remote);

                result.modified.should.have.length(1);
                result.removed.should.have.length(1);
                result.added.should.have.length(1);

                should.deepEqual(result.added, [
                    { lib: 'bem-bl', version: 'dev' }
                ]);
                should.deepEqual(result.modified, [
                    { lib: 'bem-components', version: 'v2' }
                ]);
                should.deepEqual(result.removed, [
                    { lib: 'bem-core', version: 'v2' }
                ]);

                model.getChanges().pages.added.should.have.length(1);
                model.getChanges().pages.modified.should.have.length(1);
                model.getChanges().pages.removed.should.have.length(1);

                should.deepEqual(model.getChanges().pages.added, [
                    { lib: 'bem-bl', version: 'dev' }
                ]);
                should.deepEqual(model.getChanges().pages.modified, [
                    { lib: 'bem-components', version: 'v2' }
                ]);
                should.deepEqual(model.getChanges().pages.removed, [
                    { lib: 'bem-core', version: 'v2' }
                ]);
            });
        });
    });
});
