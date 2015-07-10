var path = require('path'),
    should = require('should'),
    Config = require('bs-builder-core/lib/config'),
    Model = require('bs-builder-core/lib/model/model'),
    LibrariesBase = require('../../lib/tasks/libraries-base');

describe('LibrariesBase', function () {
    it('should return valid task name', function () {
        LibrariesBase.getName().should.equal('base libraries class');
    });

    describe('instance methods', function () {
        var config, task;

        beforeEach(function () {
            config = new Config('debug');
            task = new LibrariesBase(config, { baseUrl: '/libraries'});
        });

        describe('_getLibrariesCachePath', function () {
            it('should get valid libraries cache path with given "baseUrl"', function () {
                task.getLibrariesCachePath()
                    .should.equal(path.join(task.getBaseConfig().getCacheFolder(), 'libraries'));
            });

            it('should get valid libraries cache path with default "baseUrl"', function () {
                task.getTaskConfig().baseUrl = undefined;
                task.getLibrariesCachePath()
                    .should.equal(path.join(task.getBaseConfig().getCacheFolder(), 'libs'));
            });
        });

        describe('_getLibVersionPath', function () {
            it('should return valid library version path in cache', function () {
                task.getLibVersionPath('bem-core', 'v1.0.0')
                    .should.equal(path.join(task.getBaseConfig().getCacheFolder(), 'libraries/bem-core/v1.0.0'));
            });
        });
    })
});
