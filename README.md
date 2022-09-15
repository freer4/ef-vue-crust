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


## Functionality

### Connection

Using Axios and environment settings, Crust Connection object knows where and how to find the Mantle endpoints. This also includes some token handling for JWT authentication. 

### Session

In conjunction with Connection, Crust Session object is a simple current-user-state interface for keeping track of... session. I don't know what else I can tell you about session.

### Database

The Crust Database is a proxy that handles dot-notation access to the entire data structure defined by your Mantle model exports.

> Posts[id]Comments[1].Author.Friends[6].DisplayName

This juggles between existing data in memory and asking for data from Mantle through the Connection object and the promises it returns. It's all Vue refs and custom proxies, allowing you to ask for data that doesn't exist in the browser yet, and letting Vue reactivity to do its thing without further configuration or worry for you, the developer. 

### Data Types

Custom data types can be defined to allow standardized interaction with .Net data types. 

With the exception of Crust's Model object and Enum class, these are extensions of the included DataType js class, which allows Crust Models to understand that these are non-js-standard data types. These have defined setter functions to translate the data from a format used in C# to an appropriate format usable by JS through Crust. They also have an _out property, re-translating the value to something C# appropriate and used by Crust to return sensible data to Mantle without further custom mapping and handling.

TL;DR: basically just a way to translate data types between C# and JS.

Built in are a few key types:

- Model: this is the big one, acting much the same way a C# model class does, plus the navigation style of Entity Frame Core. This works hand-in-hand with the Database proxy to provide an object you can utilize without worry about how the data will eventually get to the Vue presentation layer. 

- Enum: this is the base for any Enum classes created through Mantle. Stored internally as int:string pairs, similar to C# enums, the setter takes an int and the getter returns a string. There is also a utlity _reverse object that will return the key int for a matching string value. 

- BitArray: this class takes a string of 0s and 1s from Mantle, giving you an array of bools when accessing it. We've used this to implement things like scheduling and permissions flags on the front end. BitArray._out property returns a string of 0s and 1s that C# understands. 

- Guid: this class is mostly to mark a property as being a C# Guid, though otherwise it behaves as a normal string. The _out property simply returns the string value.

- Point: an object with lattidue and longitude properties. This will likely be extended in the future, but we've used (with a custom JSON formatter on the .Net end) it to cleanly transport Point class data between EFCore models and Vue... views... without needing futher intermediary view models and such with individual lat/long properties defined.  _out simply returns an object with lattidue and longitude properties.


### Quick example
```
<script>
import {Database} from 'ef-vue-crust';
import PostModel from '@/data/models/PostModel'; //wherever your model files from Mantle live

export default {
    name: "PostList",
    setup() {
        //this sets up a local virtual "table" for "PostModel" if it hasn't been used before
        //which returns a proxy object to that local virtual table
        //and finally we ask for that data as a Vue reactive array 
        const posts = Database[PostModel.name].array;

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

The `.array` property is a Vue reactive collection of any potential `PostModel` instances. This is empty until you try to access deeper data or otherwise tell `Database` to go and get data. For example, if you know the PrimaryKey (Id) for the post you want to access, `posts[id]` will: 

- Check the local `_database[PostModel]` object, an in-memory data collection, for the existance of this Id. 
- If it does not exist, it will create an empty PostModel instance with this Id. This reference is returned immediately, allowing you to chain further down the data structure without needing to wait for actual data to be loaded.
- `Database` will then add this Id to a queue that will use `Connection` to seamlessly ask for the data for your front-end-accessed records from Mantle.
- When the data is returned from Mantle, it is used to update the existing, corresponding reactive PostModel object, which in turn triggers Vue's UI updates. 

So accessing `posts[id].title` will show an empty string in your vue template until it manages to get the data back from the server, at which point that beautiful Vue renderer will update the UI with the value. That's not ideal, so there are lots of helpers built in to make the user experience even better. 

## Setup

> npm install ef-vue-crust

You'll have to have set up Mantle already for Crust to do anything of importance. Otherwise, you won't have any model objects or API endpoints to work with.

`Connection` object looks for a `VUE_APP_MANTLE_URL` setting to know who to talk to, so add the path of your Mantle API root in your .env files: 

```
VUE_APP_MANTLE_URL=https://localhost:7081/

```

## Database object

Include the `Database` object from 'ef-vue-crust' and any of your models that were created by Mantle. 
```
import { Database } from 'ef-vue-crust';
import PostModel from '@/data/models/PostModel'; //wherever your model files from Mantle live
```

In your Vue setup or elsewhere, access a data collection like so: 

```
    const PostData = Database[PostModel.name];
```

### Methods

These methods are available on your `Database[Model]` object

---

`equals(prop, spec, subset = false)`
- `prop` (property) is a string of the dot-notation property path you want to match on. This could be a property of the current model, i.e. `created`, or it could be a property on a related model, i.e. `categories.title`. Mantle will know what to do with that path and setup the EF Core query appropriately. 
- `spec` is the value you are searching for. For now, all matches are case-insensitive
- `subset` is optional, and takes an array of ids. If passed, the return will only include any of these ids that matched the query, rather than all ids returned by the API call. 

This does not return the actual data for the matches, but rather the ids of any matching records. The results of the query are remembered to prevent repeat API calls.

---

`contains` NOT IMPLEMENTED - fuzzy search - //TODO implement this, already in Mantle

---

`orderBy(prop, direction, subset=false)`
- `prop` (property) is a string of the dot-notation property path you want to order this model on. This could be a property of the current model, i.e. `created`, or it could be a property on a related model, i.e. `categories.title`. Mantle will know what to with that path and return a list of ids ordered by your desired property. 
- `direction` (default 1) 1 = ascending, 0 = descending //TODO check if I wrote that backwards lol 
- `subset` is optional, and takes an array of ids. If passed, the return will be an array of only these ids, but reordered, rather than all of the ordered ids for a given property. 

This does not return the actual data for the set, but rather the ids of the data type in the order desired. This is supremely useful for infinite-scroll table/list views, where you can reorder on any property without needing to load the data, then load only the rows currently visible to the user. //TODO add example component for inifnite scroll, lazy-load list view.

Once this is loaded up, it doesn't need to be fetched again unless the data changes. Instead, it saves the ordered list of ids locally like an index. Subset ordering will then use an existing index to reorder the subset on the front end, avoiding extra calls all the way back to the DB just to sort. If the ascending or descending is asked for and the inverse is already indexed, Crust will just invert it.

The less waiting for the server our UI needs to do, the better our UX can be.

---

`all()`

No parameters.

Returns a promise. 

**USE. SPARINGLY.** This method *will* ask for the *entire* collection of available data from Mantle for this Model. This is very useful for small data collections that change enough to not make sense as an Enum, but static and universal enough that you might want to preload them immediately.

---

`load(subset)`
- `subset` an array of ids

Similar to `.all()` but not as dangerous, you can pass a list of ids in and load data for that subset of the model. Great for pre-loading sub-data of a many-to- relationship for a given record - just pass the ids list, i.e. `Database[PostModel.name].load(myCurrentPost.commentsIds)`.

Dev story: I formerly had the no-parameter version of this do what `all` does, nice and succinct. I borked so many things by accident. Having `all` separate is a good thing.

---

`add(id, data)`
- `id` the id of the record you want to add. Must match the id type on the Model (int or guid)
- `data` an object with the values for the corresponding properties on the Model. Extra properties are ignored.

Pretty straightforward, you can add records locally to the Database for this Model. 

*Not entirely implemented yet.* 

//TODO Some basic data validation can be had here also, knowing things like the nullability of the C# models to determine if a property is optional, etc. Basic validation decorators can be translated down for Crust also. Create/Update really isn't fleshed out yet in this go, but I have a lot of previous code to pull in here yet.

---

`update(id, data)` not implemented yet.  

### Properties

These properties are available on your `Database[Model]` object

---

`keys` 

A Vue reactive array of keys that already exist locally for this Model. Not something you're likely to use.

---

`list`

A Vue reactive array of keys that... wait we already have that? This is the more useful version, but use with caution. The first time this is accessed, it will quietly kick off an API call to get the list of every accessible id for this Model, and return the same internal Vue reactive array that `.keys` does. 

**!important** use `.list` to see what record ids you have without loading up the data for said records. If you try to access the ids for a data collection through the individual Model objects (such as looping through the entire data array), the accessing of those Model objects will trigger their load from Mantle. 

---

`array`

A Vue reactive array of the available Model data. This is what you will pass to your template most often. New records are automatically pushed to it, giving you that awesome Vue reactivity downstream. 

Dev story: this is accessed through a property instead of being the default return for `Database[Model]` because of some really terrible things that happen when mixing a vue reactive and the database proxies. Basically, it just keeps trying to access every property everywhere, and will systematically seek out every relationship in your database until the client has the entire available data store. This is *literally* infinitely worse if you have circular data references.

---

`length`

A Vue ref to the number of ids currently in the `Database[Model]`. Most often used after `.list`, ensuring all current ids have been fetched from Mantle, regardless of if the records have been pulled down yet.

---

`loaded`

A Vue ref to the current state of the `Database[Model]`, which is true if all known record ids have been loaded. This is actually unlikely to be useful to you, you probably want the individual model record's `.loaded` property.

---

`loader`

Returns a promise object, created from `Promise.All` using every outstanding promise for this Model.

---

`promises`

Returns an array of every outstanding promise for this Model.

## Model object

```
const post = Database[PostModel.name][postId];
```

Now that you have your model object, what do you do with it? 

Any property defined by your exported C# Model from Mantle will be enumerable and accessible. Properties for related models are seamlessly accessed from the Database object automatically based on their Foreign Key. Just drill into your model object how you like and the data will be gathered for you.

There are a few extra properties and methods to help you out.

### Methods

`_trigger()`

No parameters, no return. Pokes the reactive model for sticky situations. I haven't had to use this since rebuilding this library, so I've forgotten why I needed it and it looks like I ~~am a genius~~ incidentally fixed the issue.

---

`_populate(record)` 

Takes a naked object of property:values (such as that returned from Mantle) and populates each model property. This does all the wiring for relationships and handles any data-type translations for those non-js-standard data types, such as guids, bit-arrays, and points.

You shouldn't be using this directly very often, Mantle should be populating your data automatically.

---

`_out()`

Returns the current values for the record, converted back to formats ready to be shipped back up to C# through Mantle. 

Again, you shouldn't be using this directly very often, mostly useful for debugging.



### Properties


`_loaded`

Returns a bool, guess what for? This is how Database knows if it needs to fetch something. Not reactive, use for immediate checking.

---

`_loader`

Returns a promise that gets resolved once the model is loaded with data via `_populate`. Great for hiding UI elements until the record is ready to roll. 

---

`_fetching` 

Returns a bool, indicating if this record is in the process of fetching data from Mantle

---

`_error`

Returns false, or an error object. The error object is not implemented yet, so will always be false currently.
 
---

`_values`

Gives you a naked object of property:values for this record. If you're using this a bunch, you're probably doing it wrong. Just access the properties directly and let the proxy do its thing. 

---

`_toReactive` 

Returns a Vue shallowRef wrap of the record. Usually not necessary - because object properties are pointers, simply referring to the properties directly covers most scenarios. This is mostly used for some tricky stuff in the JS of more complex applications. (TODO Get some examples in here, ya bonehead. This description doesn't help anyone.)



## Examples
Yeah examples would help.

