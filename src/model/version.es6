import path from 'path';
import vow from 'vow';
import Base from './base';
import Level from './level';

export default class Version extends Base {
    constructor(baseUrl, basePath, lib, version, languages) {
        super();
        this.baseUrl = baseUrl;
        this.basePath = basePath;
        this.languages = languages;

        this.lib = lib;
        this.version = version.replace(/\//g, '-');
    }

    _getSourceUrls(data, languages) {
        var defaultLanguage = languages[0],
            result = languages.reduce((prev, item) => {
                prev[item] = null;
                return prev;
            }, {});

        if(!data.url) {
            return result;
        }

        result = languages.reduce((prev, item) => {
            prev[item] = `${data.url}/tree/${data.ref}`;
            if (item !== defaultLanguage) {
                prev[item] += `/README.${item}.md`;
            }
            return prev;
        }, result);
        return result;
    }

    _setSource(data) {
        var readme = data.docs ? data.docs['readme'] : data['readme'],
            basePath = path.join(this.basePath, this.lib, this.version),
            promises = this.languages.map((lang) => {
                var filePath = path.join(basePath, `${lang}.html`),
                    content = (readme && readme.content) ? readme.content[lang] : null;

                return this.saveFile(filePath, content, false).then(() => {
                    return this.setValue('contentFile',
                        ['', this.baseUrl, this.lib, this.version, lang].join(path.sep) + '.html', lang);
                });
            });

        return vow.all(promises);
    }

    _processDocuments() {
        return [];
    }

    _processLevels(data) {
        var levels = data.levels;

        if (!levels || !levels.length) {
            return Promise.resolve([]);
        }

        return vow.all(levels.map(level => {
            return (new Level(this, level.name).processData(level));
        }));
    }

    _saveToCache(content) {
        return this.saveFile(path.join(this.basePath, this.lib, this.version, 'cache.json'), content, true);
    }

    process(data) {
        var sourceUrls = this._getSourceUrls(data, this.languages);

        this.setValue('url', `${this.baseUrl}/${this.lib}/${this.version}`)
            .setValue('aliases', [])
            .setValue('view', 'post')
            .setValue('lib', this.lib)
            .setValue('version', this.version)
            .setValue('deps', data.deps);

        this.languages.forEach(lang => {
            this.setValue('title', this.version, lang)
                .setValue('published', true, lang)
                .setValue('updateDate', +(new Date()), lang)
                .setValue('hasIssues', data.hasIssues, lang)
                .setValue('sourceUrl', sourceUrls[lang], lang);
        });

        return this._setSource(data)
            .then(() => {
                return vow.all([
                    this._processDocuments(data),
                    this._processLevels(data)
                ]);
            })
            .spread((documents, levels) => {
                return this.getData().concat(documents).concat(levels);
            })
            .then(this._saveToCache.bind(this));
    }
}
