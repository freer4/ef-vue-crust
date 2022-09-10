# ef-vue-crust
A package to connect EfVueMantle to Vue3

== If you're finding this already somehow, please know this is a very incomplete restart of a thing I've rebuilt a couple of times, this will hopefully be a clean, clear, trimmed down version of that system ==

What this project aims to do, ideally, is allow data models from .net applications to be understood and interacted with by Vue3 applications. 


## Stack

### Entity Framework Core
Define your models as you do today, using EfVueMantle.ModelBase as your base class.

### EfVueMantle 

[Get is on GitHub](https://github.com/freer4/ef-vue-mantle) or Nuget.org

Mantle provides bases for model, controller, and service for each data type. This scaffolds the basic functionality allowing Crust to explore data via convention. It also crafts Javascript class files for Crust, allowing your Vue3 application to understand your entire data structure.

### ef-vue-crust

[Get it on GitHub](https://github.com/freer4/ef-vue-crust)

Provides interfaces for Vue3 to interact with your defined data models via convention. 

Creates a virtual "Database" that holds onto records, remembers query results and sort orders, and generally lets you worry about presentation instead of how to transfer data back and forth.

### Vue3
Traverse properties in your Vue3 components with dot notation object accessors, and let ef-vue-crust worry about asyncronous data loading.  

(Core, Mantle, Crust, get it? Great. Naming things is hard.)

## Functionality

### Connection

Using Axios and environment settings, Crust Connection object knows where and how to find the Mantle endpoints. This also includes some token handling for JWT authentication. 

### Session

In conjunction with Connection, Crust Session object is a simple current-user-state interface. 

### Database

The Crust Database is a proxy that handles dot-notation access to the entire data structure defined by your Mantle model exports.

> Posts.4.Comments.2.Author.Friends.6.DisplayName

This juggles between existing data in memory and asking for data from Mantle through the Connection object and the promises it returns. It's all Vue refs and custom proxies, allowing you to ask for data that doesn't exist in the browser yet, and letting Vue reactivity to do its thing without further configuration or worry for you, the developer. 

### Data Types

Custom data types can be defined to allow standardized interaction with .Net data types. 

With the exception of the Model object and Enum class, these are extensions of the included DataType js class, which allows Crust Models to understand that these are non-js-standard data types. These have defined setter functions to translate the data from a format used in C# to an appropriate format usable by JS through Crust. They also have an _out property, re-translating the value to something C# appropriate and used by Crust to return sensible data to Mantle without further custom mapping and handling.

TL;DR: basically just a way to translate data types between C# and JS.

Built in are a few key types:

- Model: this is the big one, acting much the same way an Entity Framework Core model does. This works hand-in-hand with the Database proxy to provide an object you can utilize without worry about how the data will get to the View. 

- Enum: this is the base for any Enum classes created through Mantle. Stored internally as int:string pairs, similar to C# enums, the setter takes an int and the getter returns a string. There is also a utlity _reverse object that will return the key int for a matching string value. 

- BitArray: this class takes a string of 0s and 1s from Mantle, giving you an array of bools when accessing it. We've used this to implement things like scheduling and permissions flags on the front end. BitArray._out property returns a string of 0s and 1s that C# understands. 

- Guid: this class is mostly to mark a property as being a C# Guid, though otherwise it behaves as a normal string. The _out property simply returns the string value.

- Point: an object with lattidue and longitude properties. This will likely be extended in the future, but we've used (with a custom JSON formatter on the .Net end) it to cleanly transport Point class data between EFCore models and Vue... views... without needing futher intermediary view models and such with individual lat/long properties defined.  _out simply returns an object with lattidue and longitude properties.


### Quick example
```
<script>
import {Database} from '@ef-vue-crust';
import PostModel from '@/data/models/PostModel'; //wherever your model files from Mantle live

export default {
    name: "PostList",
    setup() {
        //this sets up a local virtual "table" for "PostModel" if it hasn't been used before
        //which returns a proxy object to that local virtual table
        //and finally we ask for that data as a Vue reactive array 
        const post = Database[PostModel.name].array;

        return {
            post,
        };
    }
}
</script>
```