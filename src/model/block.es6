import path from 'path';
import vow from 'vow';
import Base from './base';

export default class Block extends Base {
    constructor(level, block) {
        super();
        this.level = level;
        this.block = block;
    }

    _rectifyBlockDocumentation(blockDocumentation, lang) {
        // TODO реализовать выпрямление данных документации здесь
        // TODO оставить только данные для языка lang
        lang;
        return blockDocumentation;
    }

    _rectifyBlockJSDocumentation(blockJSDocumentation, lang) {
        // TODO реализовать выпрямление данных jsdoc здесь
        // TODO оставить только данные для языка lang
        lang;
        return blockJSDocumentation;
    }

    _setSource(data) {
        var version = this.level.version,
            basePath = path.join(version.basePath, version.lib, version.version, this.level.level, this.block),
            blockDoc = data.data || null,
            blockJSDoc = data.jsdoc || null,
            promises = version.languages.map(lang => {
                var filePath = path.join(basePath, `${lang}.json`),
                    content = {
                        data: this._rectifyBlockDocumentation(blockDoc, lang),
                        jsdoc: this._rectifyBlockJSDocumentation(blockJSDoc, lang)
                    };

                return this.saveFile(filePath, content, true)
                    .then(() => {
                        return this.setValue('contentFile',
                            ['', version.baseUrl, version.lib, version.version,
                                this.level.level, this.block, lang].join(path.sep) + '.json', lang);
                    });
            });

        return vow.all(promises);
    }

    processData(data) {
        var v = this.level.version;

        this.setValue('url', [v.baseUrl, v.lib, v.version, this.level.level, this.block].join('/'))
            .setValue('aliases', [])
            .setValue('view', 'block')
            .setValue('lib', v.lib)
            .setValue('version', v.version)
            .setValue('level', this.level.level)
            .setValue('block', this.block);

        v.languages.forEach(lang => {
            this.setValue('title', this.block, lang)
                .setValue('published', true, lang)
                .setValue('updateDate', +(new Date()), lang);
        });

        return this._setSource(data).then(this.getData.bind(this));
    }
}
