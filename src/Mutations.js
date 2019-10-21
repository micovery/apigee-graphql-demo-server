// Copyright 2019 Google LLC
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//      http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

const helpers = require('./util');
const _ = require('lodash');
const {TrailQuery, LiftQuery, ResortQuery } = require('./Queries');
const { buildRegexFilters, applyRegexFilters, copyData } = require('./util');

class BaseMutation {
    constructor(props) {
        Object.defineProperty(this,'data', {
            get() {
                return props.data;
            },
            set(value) {
                props.data = value;
            }
        });

        _.extend(this, props);

        return this;
    }

    update(args) {
        return _.extend(this.item, args.input);
    }
}

class ItemMutation extends BaseMutation {
    constructor(args){
        super(args);

        this[this.item.constructor.name()] = (args) => this.update(args);

        return this;
    }
}

class CollectionMutation extends BaseMutation {

    _find_items({input}) {
        let regex_filters = buildRegexFilters(input);

        if (this.parent && this.parent.item) {
            _.extend(regex_filters, buildRegexFilters({[`${this.parent.item.constructor.name()}.id`]: `^${this.parent.item.id}$`}));
        }

        let items = _.chain(this.data[this.constructor.query().collection()])
            .filter((item) => applyRegexFilters(item, regex_filters))
            .value();

        return items;
    }

    update({input}) {
        let items = this._find_items({input});

        items = _.chain(items)
            .map((item) => this.constructor.query().cast(item))
            .map((item) => copyData(item, this))
            .map((item) => new (this.constructor.mutation())({
                    parent: this,
                    item: item,
                    data: this.data,
                }
            ))
            .value();

        return items;
    }

    delete({input}) {
        let items = this._find_items({input});
        let items_by_id = _.groupBy(items, 'id');

        let indexes_to_remove = [];

        let collection = this.data[this.constructor.query().collection()];
        for(let i = 0; i  < collection.length; i++) {
            if (items_by_id[collection[i].id]) {
                indexes_to_remove.push(i);
            }
        }

        for (let index of indexes_to_remove) {
            collection.splice(index, 1);
        }

        return items;
    }


    create({input}) {
        let item = new (this.constructor.query())(input);

        if (this.parent && this.parent.item) {
            item[`${this.parent.item.constructor.name()}.id`] = this.parent.item.id;
        }

        this.data[this.constructor.query().collection()].push(item);
        return item;
    }

}

/**
 * Item Mutations
 */

class ResortMutation extends ItemMutation {
    resort(args) {
        return this.update(args);
    }

    trails() {
        return new TrailsMutation({
            parent: this,
            data: this.data,
        });
    }

    lifts() {
        return new LiftsMutation({
            parent: this,
            data: this.data
        });
    }
}

class LiftMutation extends ItemMutation { }
class TrailMutation extends ItemMutation { }


/**
 * Collection Mutations
 */
class ResortsMutation extends CollectionMutation {

    static query() {
        return ResortQuery;
    }

    static mutation() {
        return ResortMutation;
    }

}

class LiftsMutation extends CollectionMutation {
    static query() {
        return LiftQuery;
    }

    static mutation() {
        return LiftMutation;
    }
}

class TrailsMutation extends CollectionMutation {
    static query() {
        return TrailQuery;
    }

    static mutation() {
        return TrailMutation;
    }
}

/**
 * Top Level Mutation
 */

class Mutation extends BaseMutation {
    constructor(args) {
        super(args);

        this.resorts = (args) => new ResortsMutation({
            parent: null,
            data: this.data,
        });

        return this;
    }
}

module.exports = {
    Mutation,
    ResortMutation,
    LiftMutation,
    TrailMutation,
    ResortsMutation,
    LiftsMutation,
    TrailsMutation
};
