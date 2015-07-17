import vow from 'vow';
import Base from './base';
import Block from './block';

export default class Level extends Base {
    constructor (version, level) {
        super();
        this.version = version;
        this.level = level.replace('.docs', '').replace('.sets', '');
    }

    processData(data) {
        var version = this.version;

        this.setValue('url', [version.baseUrl, version.lib, version.version, this.level].join('/'))
            .setValue('aliases', [])
            .setValue('view', 'level')
            .setValue('lib', version.lib)
            .setValue('version', version.version)
            .setValue('level', this.level);

        version.languages.forEach(lang => {
            this.setValue('title', this.level, lang)
                .setValue('published', true, lang)
                .setValue('updateDate', +(new Date()), lang);
        });

        return vow
            .all(data.blocks.map(block => {
                return (new Block(this, block.name)).processData(block);
            }))
            .then(blocks => {
                return blocks.reduce((prev, item) => {
                    return prev.concat(item);
                }, [this.getData()]);
            });
    }
}
