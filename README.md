# ef-vue-crust
A package to connect EfVueMantle to Vue3

What this project aims to do, ideally, is allow data models from .net applications to be understood and interacted with by Vue3 applications. 


## At this stage, nothing is sacred, any updates might be breaking. 

> If you're finding this already somehow, please know this is a very incomplete restart of a thing I've rebuilt a couple of times, this will hopefully be a clean, clear, trimmed down version of that system. If this message is here, consider it an Alpha version

## Stack

### Entity Framework Core
Define your models as you do today, using EfVueMantle.ModelBase as your base class.

### EfVueMantle 

[Get it on GitHub](https://github.com/freer4/ef-vue-mantle) or [Nuget.org](https://www.nuget.org/packages/EfVueMantle)

Mantle provides bases for model, controller, and service for each data type. This scaffolds the basic functionality allowing Crust to explore data via convention. It also crafts Javascript class files for Crust, allowing your Vue3 application to understand your entire data structure.

### ef-vue-crust

[Get it on GitHub](https://github.com/freer4/ef-vue-crust) or `npm install ef-vue-crust`

Provides interfaces for Vue3 to interact with your defined data models via convention. 

Creates a virtual "Database" that holds onto records, remembers query results and sort orders, and generally lets you worry about presentation instead of how to transfer data back and forth.

### Vue3
Traverse properties in your Vue3 components with dot notation object accessors, and let ef-vue-crust worry about asyncronous data loading.  

(Core, Mantle, Crust, get it? Great. Naming things is hard.)

## Concept

The basic concept is the ability to write your data models once, using EF Core code-first database creation, and then have full, clean, easy, access to that structure and data all the way down into the UI. 

(This doesn't need to be C#/.Net only, but it's the only server-side package I've built to support it so far. If you're interested in creating a version of Mantle for another language or framework, I'm happy to help!)

Crust tries to cover all common data-use scenarios in a good user experience, for both the developer using the module and the client using your application.

There's a huge caveat to the use of this module: data size. It can at times rely on lists of all accessible ids for entire data sets, depending on what you're doing. It's perfectly possible to use this module and only pull a single record at a time, and avoid this issue altogether. This can be further negated for many applications by limiting access to records in EF Core with your authorization implementation so that data sets are automatically trimmed down by user. But if you find yourself in a scenario where a user may have access to millions of rows of data and need to order the entire set, or show it in a list-view, this system will quickly be overwhelmed and eat client memory trying to track all of the data locally. //TODO Look at juggling data back out of local storage (even manually) to allow further negation of this issue

In theory, JS can utilize arrays with over 4 billion elements, and performance is highly reliant on the browser and hardware of the client. 

In practice, even the low millions of rows will likely provide a bad user experience. 

I will endeavor to get better performance benchmarks to demonstrate, but for this early stage, this framework will be useful for you if:
- Your need is smoothly getting data from database to user, without a whole lotta custom code between
- Individual client users have access to at most tens- or maybe hundreds- of thousands of records at any given time, but preferably far fewer


## Connection object

Using Axios and environment settings, the Crust `Connection` object knows where and how to find the Mantle endpoints. This also includes some token handling for JWT authentication. **TODO** There is work being done to make this smarter, allowing authentication to be abstracted/passed in 

## Session object

In conjunction with `Connection`, the Crust `Session` object is a simple current-user-state interface for keeping track of... session. I don't know what else I can tell you about session. Properties added to this object are also stored in browser session and retrieved on page load. 

---

`_set(session)`
- `session` is an object of key value pairs you wish to store at the session level. A key called "token" will be used by `Connection` for the authorization header, and its presence determines if a user is "logged in"

---

`_unset()`

No parameters.

Clears out the `Session` and "logs out" the user.

---

`_isLoggedIn()`

No parameters.

Returns a bool 


## Database

The Crust Database is a proxy that handles dot-notation access to the entire data structure defined by your Mantle model exports.

**Example:**

> posts[id].comments[1].author.friends[6].displayName

This juggles between existing data in memory and asking for data from Mantle through the Connection object and the promises it returns. It's all Vue refs and custom proxies, allowing you to ask for data that doesn't exist in the browser yet, and letting Vue reactivity to do its thing without further configuration or worry for you, the developer. 

## Data types

Custom data types can be defined to allow standardized interaction with .Net data types. 

With the exception of Crust's Model object and Enum class, these are extensions of the included DataType js class, which allows Crust Models to understand that these are non-js-standard data types. These have defined setter functions to translate the data from a format used in C# to an appropriate format usable by JS through Crust. They also have an _out property, re-translating the value to something C# appropriate and used by Crust to return sensible data to Mantle without further custom mapping and handling.

TL;DR: basically just a way to translate data types between C# and JS.

Built in are a few key types:

- Model: this is the big one, acting much the same way a C# model class does, plus the navigation style of Entity Frame Core. This works hand-in-hand with the Database proxy to provide an object you can utilize without worry about how the data will eventually get to the Vue presentation layer. 

- Enum: this is the base for any Enum classes created through Mantle. Stored internally as int:string pairs, similar to C# enums, the setter takes an int and the getter returns a string. There is also a utlity _reverse object that will return the key int for a matching string value. 

- Flag: takes a raw int, and returns an array of ints of 2^n. Your record will have access to the array, which you can manipulate. Internally validates that each value is of 2^n.
- - *static* toArray(value): takes an int value and returns an array of ints of 2^n
- - *static* toInt(value): takes an array of ints of 2^n and returns an int
- - *static* toReadable(value, options): takes an array of ints and object of key:value pairs (such as a flag enum), creates a neat little human-friendly string like "one, two, and three"

In Mantle, the decorators for a flag with a matching enum:
```
[EfVueEnum(typeof(RoleType))] //your flag enum (shows up in the config in the Crust model properties)
[EfVuePropertyType("Flag")] //tell Crust to use the flag type
public int Markings { get; set; } = 0; //whatever number property you're using to store the flag
```

- BitArray: TODO: reevaluate how this is used  

- Guid: this class is mostly to mark a property as being a C# Guid, though otherwise it behaves as a normal string. The _out property simply returns the string value.

- Point: an object with lattidue and longitude properties. This will likely be extended in the future, but we've used (with a custom JSON formatter on the .Net end) it to cleanly transport Point class data between EFCore models and Vue... views... without needing futher intermediary view models and such with individual lat/long properties defined.  _out simply returns an object with lattidue and longitude properties.

### Custom data types

You can add your own data types as needed. Put these in a directory named "data-types", adjacent to the directories for models, unums, and dtos output by Mantle. 

In Mantle, decorate the property like this: 

```
    [EfVuePropertyType("SomeType")]
```

This will add an include for your custom data-type definition `SomeType`, looking for `/path/to/your/data/data-type/some-type.js`

## Quick data access example:
```
<script>
import {Database} from 'ef-vue-crust';
import PostModel from '@/data/models/PostModel'; //wherever your model files from Mantle live

export default {
    name: "PostList",
    setup() {
        //this sets up a local virtual "table" for "PostModel" if it hasn't been used before
        //which returns a proxy object to that local virtual table
        const posts = Database[PostModel.name];

        return {
            posts,
        };
    }
}
</script>
```

> Wait, does this `posts` object have all of our data?

Nope, this example understands that you want to use a Database containing records for your PostModel and will wait patiently for you to access the data before it fetches it. `PostModel` is coming from a JS file created by Mantle that informs Crust exactly what that data will look like without any API calls so far. 

If this is the first time your application has attempted to access the `PostModel` records in `Database`, an object handling all interactive functionality for it is quietly created in the background and returned to you. None of the actual posts data has been acquired from the server yet. No calls to the API have been made at all so far.

`posts` is empty until you try to access deeper data or otherwise tell `Database` to go and get data. For example, if you know the PrimaryKey (Id) for the post you want to access, `posts[id]` will: 

- Check the local `_database[PostModel]` object, the in-memory data collection, for the existance of this Id. 
- If it does not exist, it will create an empty `PostModel` instance with this Id. This reference is returned immediately, allowing you to chain further down the data structure.
- `Database` will then add this Id to a queue that will use `Connection` to seamlessly ask for the data for your front-end-accessed records from Mantle.
- When the data is returned from Mantle, it is used to update the existing, corresponding reactive PostModel object, which in turn triggers Vue's UI updates. 

So accessing `posts[id].title` will show an empty string in your vue template until it manages to get the data back from the server, at which point that beautiful Vue renderer will update the UI with the value. That's not ideal, so there are lots of helpers built in to make the user experience even better, such as a `_loaded` bool. 

## Setup

> npm install ef-vue-crust

You'll have to have set up Mantle already for Crust to do anything of importance. Otherwise, you won't have any model objects or API endpoints to work with.

`Connection` object looks for a `VUE_APP_MANTLE_URL` setting to know who to talk to, so add the path of your Mantle API root in your .env files: 

```
VUE_APP_MANTLE_URL=https://localhost:7081/

```

## Database object

```
import { Database } from 'ef-vue-crust';
```

This is the object used to access all local "tables". Access is handled by proxies, creating tables on the fly the first time a user attempts to access them. 

---

## Table object

"Tables" are local collections of your models, accessed via convention through the Database object. 

A simple example

```
import { Database } from 'ef-vue-crust';
import PostModel from '@/data/models/PostModel'; //wherever your model files from Mantle live

const posts = Database[PostModel.name];
```

`posts` is a table object full of handy methods and properties. Access a record by id like `posts[id]` and a proxy will return the appropriate Model object, requesting data directly from Mantle if it hasn't been loaded yet.  

### Table Methods

#### Search and sort methods (apply to both Table and Indexer objects)
---

`_equals(prop, spec, subset = false)`
- `prop` (property) is a string of the dot-notation property path you want to match on. This could be a property of the current model, i.e. `created`, or it could be a property on a related model, i.e. `categories.title`. Mantle will know what to do with that path and setup the EF Core query appropriately. 
- `spec` is the value you are searching for. For now, all matches are case-insensitive. This is a full-match.
- `subset` is optional, and takes an array of ids. If passed, the return will only include any of these ids that matched the query, rather than all ids returned by the API call. 

Returns an `indexer` object, see below

---

`_contains(prop, spec, subset = false)`
- `prop` (property) is a string of the dot-notation property path you want to match on. This could be a property of the current model, i.e. `created`, or it could be a property on a related model, i.e. `categories.title`. Mantle will know what to do with that path and setup the EF Core query appropriately. 
- `spec` is the value you are searching for. For now, all matches are case-insensitive. This is a partial match.
- `subset` is optional, and takes an array of ids. If passed, the return will only include any of these ids that matched the query, rather than all ids returned by the API call. 

Returns an `indexer` object, see below


---

`_startsWith` NOT IMPLEMENTED 

---

`_endsWith` NOT IMPLEMENTED

---

`_orderBy(prop, direction, subset=false)`
- `prop` (property) is a string of the dot-notation property path you want to order this model on. This could be a property of the current model, i.e. `created`, or it could be a property on a related model, i.e. `categories.title`. Mantle will know what to with that path and return a list of ids ordered by your desired property. 
- `direction` (default 1) 1 = ascending, 2 = descending 
- `subset` is optional, and takes an array of ids. If passed, the return will be an array of only these ids, but reordered, rather than all of the ordered ids for a given property. 

Returns an `indexer` object, see below

Once this is loaded up, it doesn't need to be fetched again unless the data changes. Instead, it saves the ordered list of ids locally like an index. Subset ordering will then use an existing index to reorder the subset on the front end, avoiding extra calls all the way back to the DB just to sort. If the ascending or descending is asked for and the inverse is already indexed, Crust will just invert it.

The less waiting for the server our UI needs to do, the better our UX can be.

---

#### Other Table methods

`_all()`

No parameters.

Returns a promise. 

**USE. SPARINGLY.** This method *will* ask for the *entire* collection of available data from Mantle for this Model. This is very useful for small data collections that change enough to not make sense as an Enum, but are static and universal enough that you might want to preload them immediately.

---

`_load(subset)`
- `subset` an array of ids

Similar to `_all()` but not as dangerous, you can pass a list of ids in and load data for that subset of the model. Great for pre-loading sub-data of a many-to- relationship for a given record - just pass the ids list, i.e. `Database[PostModel.name].load(myCurrentPost.commentsIds)`.

If `subset` is not passed, it will attempt to load all records for known ids that are not yet loaded in this table. It does not ask Mantle for the full list of ids before doing so. 

---

`_save(id/data)`
- `id/data` can be the id or the actual record reference

Sends request to Mantle to add or update this record. 

If data is passed with no Id, it's an add. If an Id is passed, or data is passed with an Id, it will attempted an update. Mostly though, it's easier to use the
`_save` method directly on the record itself. And don't loop - if you have many things to save at once, use `_saveAll`.

---

`_add(id, data)`
- `id` the id of the record you want to add. Must match the id type on the Model (int or guid)
- `data` an object with the values for the corresponding properties on the Model. Extra properties are ignored.

Adds records locally to the Database for this Model. 

---

`_saveAll(ids/references)`
- `ids` an array of ids or actual model references (or even a mix). 

Send the indicated records to Mantle to be saved. 

If `ids` parameter is omitted, all modified (including added) records for this table will be gathered and sent up. 

---

`_remove(id/reference)`
- `id` can be the id or the actual record reference

Removes the record from the local Database, but doesn't delete it from the server. 

---

`_delete(id/reference)`
- `id` can be the id or the actual record reference

Sends request to Mantle to delete the record. Also removes it from the local Database.

---

`_refresh(id/reference)`
- `id` can be the id or the actual record reference

Explicitly asks for this record from Mantle, even if you already have it loaded

Returns a promise. 

---

`_refreshList()`

No parameters.

Manually refresh the list of all ids from Mantle. See Table `_list` property.



### Table Properties

`_keys` 

A Vue reactive array of keys that *already exist locally* for this Model. You probably want the `_list` property.

---

`_list`

A Vue reactive array of keys that... wait we already have that? This is the more useful version, but use with caution. The first time this is accessed, it will quietly kick off an API call to get the list of every accessible id for this Model, and return the same internal Vue reactive array that `_keys` does. 

See `_refreshList()` table method for refreshing the values here. 

**!important** `_list` is what you use to see what record ids you have without loading up the full data for said records. If you try to access the records in the Table through the individual Model objects (such as looping through the entire Table), the accessing of those Model objects will trigger their load from Mantle. 

---

`_array`

A Vue reactive array of the available Model data. This is what you will pass to your template most often. New records are automatically pushed to it, giving you that awesome Vue reactivity downstream. 

Dev story: this is accessed through a property instead of being the default return for `Database[Model]` because of some really terrible things that happen when mixing a vue reactive and the database proxies. Basically, it just keeps trying to access every property everywhere, and will systematically seek out every relationship in your database until the client has the entire available data store. This is *literally* infinitely worse if you have circular data references.

---

`_length`

A Vue ref to the number of ids currently in the `Database[Model]`. Most often used after `_list`, ensuring all current ids have been fetched from Mantle, regardless of if the records have been pulled down yet.

---

`_loaded`

A Vue ref to the current state of the `Database[Model]`, which is true if all known record ids have been loaded. This is actually unlikely to be useful to you, you probably want the individual record's `_loaded` property.

---

`_loader`

Returns a promise object, created from `Promise.All` using every outstanding promise for this Model.

---

`_promises`

Returns a read-only array of every outstanding promise for this Model.


## Indexer object

**TODO** This is only mildly tested and might be a bit wonky yet

The `Indexer` object is actually an extension of Array. It is used to hold index lists and can chain additional search and sort functions, which will pass the result of each step into the subset property of the next.

### Indexer properties

`_loader` 

A promise, which resolves when Mantle responds to a sort search or order request. 

`_loaded`

A bool indicator of the status of _loader **TODO** don't rely on this property currently, buggy. 


### Indexer methods

`_keys()`

An array of all the ids in the Indexer object

`_list()`

A reactive array of all the ids in the 

`_array()`



## Model object

```
const post = Database[PostModel.name][postId];
```

Now that you have your model object, what do you do with it? 

Any property defined by your exported C# Model from Mantle will be enumerable and accessible. Properties for related models are seamlessly accessed from the Database object automatically based on their Foreign Key, similar to how Entity Framework navigates between records. Just drill into your model object how you like and the data will be gathered for you.

There are a few extra properties and methods to help you out.

### Methods

`_trigger()`

No parameters, no return. Pokes the reactive model for sticky situations. I haven't had to use this since rebuilding this library, so I've forgotten why I needed it and it looks like I ~~am a genius~~ incidentally fixed the issue.

---

`_populate(record)` 

Takes a naked object of property:values (such as that returned from Mantle) and populates each model property. This may be very different from values seen through direct proeprty getting and setting. 

This does all the wiring for relationships and handles any data-type translations for those non-js-standard data types, such as guids, bit-arrays, flags, and points. 

You shouldn't be using this directly very often, Mantle should be populating your data automatically.

---

`_out()`

Returns the current values for the record, converted back to formats ready to be shipped back up to C# through Mantle. 

Again, you shouldn't be using this directly very often, mostly useful for debugging.

---


`_save()`

If you're editing a record, this will ask Mantle to update it. 

If you're creating a new record, this will ask Mantle to save it. **Do not set the id** - if the id is set, it will try to update a record with that id. Let your RDB provide the primary keys for new records. 

If this model is a data transfer object, it will bypass the local Database and hit the route specified in the model definition. See (Mantle DTO)[https://github.com/freer4/ef-vue-mantle] 

TODO: if there's a related DB model for the DTO, refresh populate the Database automagically. 

---

`_remove()`

Removes this record from the local Database. 

---

`_delete()`

Sends request to Mantle to delete this record. Also removes it from the local Database 

---

`_typeof(prop)`

Returns the type of the passed property


### Properties


`_loaded`

Returns a bool if this record has been loaded. This is how Database identifies if a record needs fetched or if the local data is ready to be used.

You'll use this extensively with related objects to check if the related object is ready to use. 

**Example:**
```
<div v-if="post.author._loaded">
    <span>{{post.author.name}}</span>
</div>
```

Author's log, stardate 184.32.8: TODO It would be nice to be able to not have to wrap these. You can technically get away with a single level, as the properties will all just be empty (null, etc). I think I have a way to accomplish this, just need to try it out.

---

`_loader`

Returns a promise that gets resolved once the model is loaded with data via `_populate` - which is what it does internally when fetching from Mantle. Useful for logic around records in your setup. 

---

`_fetching` 

Returns a bool, indicating if this record is in the process of fetching data from Mantle

---

`_error`

Returns a bool, indicating if there are any errors on this record. 

**TODO**: Currently not syncing correctly with the `_errors` object, use instead:

```
Object.keys(record._errors).length
```
 
---

`_errors`

An object whose keys are any fields with a validation error. Each value is an array of error objects.

This is only updated when `_validate` method is called on the record. 

TODO: need add error method to shortcut the complex `_errors` object structure (add key, array if not existing, add object of format). Maybe codify the error object specifically. 

---

`_modified`

Returns a bool, indicating if this record has been changed locally since it was loaded. **Fair warning:** I haven't tested this much yet. 

TODO: this has an issue where initial setting of FK arrays within populate is async thanks to the watch, so it triggers _modified

---

`_values`

These are vue `ref` (or `shallowRef`, when an enumerable data type) references to the values. You can use Vue's `unref` to get the raw value from these.

The one place this is particularly useful: watches. Rather than wraping values from properties in `ref`, get the `_values` of that property:

```
watch(posts._values.comments, () => { /* Do something when posts.comments changes */ });

```

Otherwise, using this a bunch probably means you're overcomplicating matters. Just access the properties directly and let the proxy do its thing. 

---

`_toReactive` 

Returns a reactive object of this model. 

**TODO** I think this is vestigial, a holdover from a previous version, so *do not use this*. You should be able to reference the properties directly from the model object. Need to test my assumption.



## Examples
Yeah examples would help.

