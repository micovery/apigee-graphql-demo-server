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

const { buildRegexFilters, applyRegexFilters, copyData } = require('./util');
const _ = require('lodash');
const uuidv1 = require('uuid/v1');

class BaseQuery {
    constructor(props) {
        Object.defineProperty(this,'data', {
            get() {
                return props.data;
            },
            set(value) {
                props.data = value;
            }
        });

        return this;
    }

    children(args, clazz) {
        let regex_filters = buildRegexFilters(args.input) || {};
        if (this.id) {
            _.extend(regex_filters, buildRegexFilters({[`${this.constructor.name()}.id`]: `^${this.id}$`}));
        }

        let collection = clazz.collection();

        let queries = _.chain(this.data[collection])
            .filter((r) => applyRegexFilters(r, regex_filters))
            .map((r) => clazz.cast(r))
            .map((r) => copyData(r, this))
            .value();

        return queries;
    }

}

class QueryType extends BaseQuery {
    constructor(args) {
        super(args);
        _.extend(this, args);

        this.id = uuidv1();
        return this;
    }

    static cast(object) {
        if (!object) {
            return object;
        }

        object.__proto__ = this.prototype;
        return object;
    }
}

class TrailQuery extends QueryType {
    static name() {
        return 'trail';
    }

    static collection(){
        return 'trails';
    }
}


class LiftQuery extends QueryType {
    static name() {
        return 'lift';
    }

    static collection(){
        return 'lifts';
    }
}

class ResortQuery extends QueryType {
    static name() {
        return 'resort';
    }

    static collection(){
        return 'resorts';
    }

    lifts(args) {
        return this.children(args, LiftQuery);
    }

    trails(args) {
        return this.children(args, TrailQuery);
    }
}

class Query extends BaseQuery {
    constructor(args) {
        super(args);

        this.resorts = (parent, args) => this.children(args, ResortQuery);
        return this;
    }
}


module.exports = {LiftQuery, ResortQuery, TrailQuery, Query};




