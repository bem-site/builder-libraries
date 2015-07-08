import fs from 'fs';
import path from 'path';
import _ from 'lodash';
import builderCore from 'bs-builder-core';
import fsExtra from 'fs-extra';
import MDS from 'mds-wrapper';
import Q from 'q';

export default class LibrariesSyncMDS extends builderCore.tasks.Base {

    constructor(baseConfig, taskConfig) {
        super(baseConfig, taskConfig);

        var mdsOptions = taskConfig['mds'],
            mdsConfig;

        if (!mdsOptions) {
            throw new Error('MDS options were not set in task configuration');
        }

        if (!mdsOptions['namespace']) {
            throw new Error('MDS "namespace" property was not set in task configuration');
        }

        if (!mdsOptions['host']) {
            this.logger.warn('MDS host was not set. Default value "127.0.0.1" will be used instead');
            mdsOptions['host'] = '127.0.0.1';
        }

        if (!mdsOptions['port']) {
            this.logger.warn('MDS port was not set. Default value "80" will be used instead');
            mdsOptions['port'] = 80;
        }

        mdsConfig = {
            namespace: mdsOptions['namespace'],
            get: {
                host: mdsOptions['host'],
                port: mdsOptions['port']
            }
        };

        // в рамках задач сборки будут использоваться только get запросы
        // на чтение данных с mds хранилища, поэтому здесь не принципиальны настроки для post запросов
        mdsConfig.post = mdsConfig.get;
        this.api = new MDS(mdsConfig);
    }

    static getLoggerName () {
        return module;
    }

    /**
     * Return task human readable description
     * @returns {String}
     */
    static getName () {
        return 'synchronize libraries data with remote mds storage';
    }

    /**
     *
     * @returns {*|string}
     * @private
     */
    _getLibrariesCachePath() {
        return path.join(this.getBaseConfig().getCacheFolder(), (this.getTaskConfig()['baseUrl'] || '/libs'));
    }

    _getMDSRegistryFilePath() {
        return path.join(this._getLibrariesCachePath(), 'registry.json');
    }

    _getLibVersionPath(lib, version) {
        return path.join(this._getLibrariesCachePath(), lib, version);
    }

    /**
     * Loads JSON registry file from remote MDS source
     * @returns {Promise}
     * @private
     */
    _getRegistryFromCache() {
        return new Promise(resolve => {
            fsExtra.readJSON(this._getMDSRegistryFilePath(), (error, content) => {
                return resolve((error || !content) ? {} : content);
            });
        });
    }

    /**
     * Loads JSON registry file from local cache
     * @returns {Promise}
     * @private
     */
    _getRegistryFromMDS() {
        const REGISTRY_MDS_KEY = 'root';

        return new Promise((resolve, reject) => {
            this.api.read(REGISTRY_MDS_KEY, (error, content) => {
                error ? reject(error) : resolve(JSON.parse(content));
            });
        });
    }

    _createComparatorMap(registry) {
        return Object.keys(registry).reduce((prev, lib) => {
            var versions = registry[lib].versions;
            if (versions) {
                Object.keys(versions).forEach(version => {
                    prev.set(`${lib}||${version}`, versions[version]);
                });
            }
            return prev;
        }, new Map());
    }

    _compareRegistryFiles(model, local, remote) {
        var localCM = this._createComparatorMap(local),
            remoteCM = this._createComparatorMap(remote),
            added = [],
            modified = [],
            removed = [],
            processItem = (key, collection, type) => {
                let k = key.split('||'),
                    item = { lib: k[0], version: k[1] };

                this.logger.debug(`${type} lib: => ${item.lib} version: => ${item.version}`);
                model.getChanges().pages['add' + type](item);
                collection.push(item);
            };

        for (let key of remoteCM.keys()) {
            !localCM.has(key) && processItem(key, added, 'Added');
        }

        for (let key of remoteCM.keys()) {
            if (localCM.has(key)) {
                let vLocal = localCM.get(key),
                    vRemote = remoteCM.get(key);
                if (vLocal['sha'] !== vRemote['sha'] || vLocal['date'] !== vRemote['date']) {
                    processItem(key, modified, 'Modified');
                }
            }
        }

        for (let key of localCM.keys()) {
            !remoteCM.has(key) && processItem(key, removed, 'Removed');
        }

        return { added: added, modified: modified, removed: removed };
    }

    _saveLibraryVersionFile(item) {
        var lib = item.lib,
            version = item.version,
            ensureDir = Q.nbind(fsExtra.ensureDir),
            readFileFromMDS = Q.nbind(this.api.read),
            writeFile = Q.nbind(fs.writeFile);

        this.logger.debug(`Download "data.json" file for library: ${lib} and version: ${version}`);

        return Q.spawn(function* () {
            yield ensureDir(this._getLibVersionPath(lib, version));
            try {
                let content = yield readFileFromMDS(`${lib}/${version}/data.json`);
                yield writeFile(path.join(this._getLibVersionPath(lib, version), 'mds.data.json'),
                    content, { encoding: 'utf-8' });
            } catch (error) {
                this.logger
                    .error(error.message)
                    .error(`Error occur while loading "data.json" file from MDS ` +
                `for library: ${lib} and version: ${version}`);
                throw error;
            }

            return item;
        });
    }

    _removeLibraryVersionFolder(item) {
        var lib = item.lib,
            version = item.version;

        this.logger.debug(`Remove "data.json" file for library: ${lib} and version: ${version}`);

        return new Promise((resolve, reject) => {
            fsExtra.remove(this._getLibVersionPath(lib, version), (error) => {
                this.logger
                    .error(error.message)
                    .error(`Error occur while remove library version mds.data.json file from cache` +
                `for library: ${lib} and version: ${version}`);
                return reject(error);
            });
            resolve(item);
        });
    }

    /**
     * Performs task
     * @returns {Promise}
     */
    run(model) {
        this.beforeRun();

        return Q.spawn(function* () {
            fsExtra.ensureDirSync(this._getLibrariesCachePath());

            var local, remote, diff, downloadQueue, removeQueue;

            local = yield this._getRegistryFromCache();

            try {
                remote = yield this._getRegistryFromMDS();
            } catch (error) {
                this.logger
                    .error(error.message)
                    .warn('Can not load registry file from MDS storage. ' +
                    'Please verify your mds settings. Registry will be assumed as empty');
                remote = {};
            }

            diff = this._compareRegistryFiles(model, local, remote);

            downloadQueue = [].concat(diff.added).concat(diff.modified);
            removeQueue = [].concat(diff.modified).concat(diff.removed);

            yield Promise.all(removeQueue.map(item => {
                return this._removeLibraryVersionFolder(item);
            }));

            for(let portion of _.chunk(downloadQueue, 10)) {
                yield Promise.all(portion.map((item) => {
                    return this._saveLibraryVersionFile(item);
                }));
            }
        }).then(() => {
            this.logger.info(`Successfully finish task "${this.constructor.getName()}"`);
            return Promise.resolve(model);
        });
    }
}
