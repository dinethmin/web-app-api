const express = require('express');
const bodyParser = require('body-parser');
const bcrypt = require('bcrypt-nodejs');
const cors = require('cors');
const knex = require('knex')
const multer = require('multer');
const fs = require('fs');
const { notEqual } = require('assert');

const upload = multer({ dest: 'uploads/' });

const db = knex({
  client: 'pg',
  connection: {
    host: 'localhost',
    user: 'postgres',
    password: '1010',
    database: 'postgres'
  }
});

// Check if the database connection is successful
db.raw('SELECT 1')
  .then(() => {
    console.log('Database connected successfully.');
  })
  .catch((error) => {
    console.error('Error connecting to the database:', error);
  });

const app = express();

app.use(cors());
app.use(express.json());


//Student start
app.post('/Login', (req, res) => {
  db.select('email', 'hash').from('login')
    .where('email', '=', req.body.email)
    .then(data => {
      const isValid = bcrypt.compareSync(req.body.password, data[0].hash);
      if (isValid) {
        return db.select('*').from('student')
          .where('email', '=', req.body.email)
          .then(user => {
            res.json(user[0])
          })
          .catch(err => res.status(400).json('unable to get user'))
      } else {
        res.status(400).json('wrong credentials')
      }
    })
    .catch(err => res.status(400).json('wrong credentials'))
})

app.post('/Signup', (req, res) => {
  const { email, name, password, phone } = req.body;
  const hash = bcrypt.hashSync(password);
  db.transaction(trx => {
    trx.insert({
      hash: hash,
      email: email
    })
      .into('login')
      .returning('email')
      .then(loginEmail => {
        return trx('student')
          .returning('*')
          .insert({
            email: loginEmail[0].email,
            name: name,
            phone: phone
          })
          .then(user => {
            res.json(user[0]);
          })
      })
      .then(trx.commit)
      .catch(trx.rollback)
  })
    .catch(err => res.status(400).json('unable to register'))
})

// Add a route to fetch profile data by email
app.get('/Profile/:email', (req, res) => {
  const { email } = req.params;
  // Query the database to fetch admin profile data by email
  db.select('*').from('student').where({ email })
    .then(admin => {
      if (admin.length > 0) {
        res.json(admin[0]);
      } else {
        res.status(404).json({ error: 'Student not found' });
      }
    })
    .catch(error => {
      console.error('Error fetching admin profile:', error);
      res.status(500).json({ error: 'Error fetching admin profile' });
    });
});

// Update Profile
app.put('/Profile/:email', (req, res) => {
  const { email } = req.params; // Access the user's email from URL parameters
  const { name, password, phone } = req.body; // Extract updated profile data from request body

  // Update profile data in the database
  db.transaction(trx => {
    // Update name and phone in the admin table
    trx('student')
      .where({ email })
      .update({ name, phone })
      .then(() => {
        // Update password in the adminlogin table if provided
        if (password) {
          const hash = bcrypt.hashSync(password);
          trx('login')
            .where({ email })
            .update({ hash })
            .then(() => {
              res.json({ message: 'Profile updated successfully' });
            })
            .catch(err => {
              console.error('Error updating password:', err);
              res.status(500).json('Error updating password');
            });
        } else {
          res.json({ message: 'Profile updated successfully' });
        }
      })
      .then(trx.commit)
      .catch(trx.rollback);
  })
    .catch(err => {
      console.error('Error updating profile:', err);
      res.status(500).json('Error updating profile');
    });
});
//Student end


//Landlord start
app.post('/LandlordLogin', (req, res) => {
  db.select('email', 'hash').from('landlordlogin')
    .where('email', '=', req.body.email)
    .then(data => {
      const isValid = bcrypt.compareSync(req.body.password, data[0].hash);
      if (isValid) {
        return db.select('*').from('landlord')
          .where('email', '=', req.body.email)
          .then(user => {
            res.json(user[0])
          })
          .catch(err => res.status(400).json('unable to get user'))
      } else {
        res.status(400).json('wrong credentials')
      }
    })
    .catch(err => res.status(400).json('wrong credentials'))
})

app.post('/LandlordSignup', (req, res) => {
  const { email, name, password, phone } = req.body;
  const hash = bcrypt.hashSync(password);
  db.transaction(trx => {
    trx.insert({
      hash: hash,
      email: email
    })
      .into('landlordlogin')
      .returning('email')
      .then(loginEmail => {
        return trx('landlord')
          .returning('*')
          .insert({
            email: loginEmail[0].email,
            name: name,
            phone: phone
          })
          .then(user => {
            res.json(user[0]);
          })
      })
      .then(trx.commit)
      .catch(trx.rollback)
  })
    .catch(err => res.status(400).json('unable to register'))
})

app.post('/AddProperty', upload.array('photos'), (req, res) => {
  const { name, description, address, facilities, phone, availableFor, price, markers, landlord } = req.body;
  const photos = req.files.map(file => file.path); // Extract file paths from req.files

  // Insert property data into the database
  db('property')
    .insert({
      name,
      description,
      address,
      facilities,
      phone,
      availablefor: availableFor,
      price,
      landlord,
      photos: photos, // Insert array directly instead of JSON.stringify
      markers: JSON.stringify(markers)
    })
    .returning('*')
    .then(property => {
      res.json(property[0]);
    })
    .catch(err => {
      console.error('Error adding property:', err);
      res.status(500).json('Error adding property');
    });
});

app.get('/LandlordReservations/:email/Reserve', (req, res) => {
  const { email } = req.params; // Access the property ID from URL parameters
  // Query the database to fetch all properties
  db.select('*').from('property').where({ landlord: email })
    .then(property => {
      res.json(property);
    })
    .catch(error => {
      console.error('Error fetching properties:', error);
      res.status(500).json({ error: 'Error fetching properties' });
    });
});

app.get('/LandlordReservations/:email', (req, res) => {
  const { email } = req.params;
  // Query the database to fetch all properties
  db.select('*').from('property').whereNotNull('email').andWhere('landlord', '=', email)
    .then(properties => {
      res.json(properties);
    })
    .catch(error => {
      console.error('Error fetching properties:', error);
      res.status(500).json({ error: 'Error fetching properties' });
    });
});

// Add a route to fetch profile data by email
app.get('/LandlordProfile/:email', (req, res) => {
  const { email } = req.params;
  // Query the database to fetch admin profile data by email
  db.select('*').from('landlord').where({ email })
    .then(admin => {
      if (admin.length > 0) {
        res.json(admin[0]);
      } else {
        res.status(404).json({ error: 'Student not found' });
      }
    })
    .catch(error => {
      console.error('Error fetching admin profile:', error);
      res.status(500).json({ error: 'Error fetching admin profile' });
    });
});

// Update Profile
app.put('/LandlordProfile/:email', (req, res) => {
  const { email } = req.params; // Access the user's email from URL parameters
  const { name, password, phone } = req.body; // Extract updated profile data from request body

  // Update profile data in the database
  db.transaction(trx => {
    // Update name and phone in the admin table
    trx('landlord')
      .where({ email })
      .update({ name, phone })
      .then(() => {
        // Update password in the adminlogin table if provided
        if (password) {
          const hash = bcrypt.hashSync(password);
          trx('landlordlogin')
            .where({ email })
            .update({ hash })
            .then(() => {
              res.json({ message: 'Profile updated successfully' });
            })
            .catch(err => {
              console.error('Error updating password:', err);
              res.status(500).json('Error updating password');
            });
        } else {
          res.json({ message: 'Profile updated successfully' });
        }
      })
      .then(trx.commit)
      .catch(trx.rollback);
  })
    .catch(err => {
      console.error('Error updating profile:', err);
      res.status(500).json('Error updating profile');
    });
});
//Landlord end


//Admin start
app.post('/AdminLogin', (req, res) => {
  db.select('email', 'hash').from('adminlogin')
    .where('email', '=', req.body.email)
    .then(data => {
      const isValid = bcrypt.compareSync(req.body.password, data[0].hash);
      if (isValid) {
        return db.select('*').from('admin')
          .where('email', '=', req.body.email)
          .then(user => {
            res.json(user[0])
          })
          .catch(err => res.status(400).json('unable to get user'))
      } else {
        res.status(400).json('wrong credentials')
      }
    })
    .catch(err => res.status(400).json('wrong credentials'))
})

/*

app.post('/PostArticles', upload.single('content_img'), (req, res) => {
  const { headline, author, subHeader, content } = req.body;
  const contentImgPath = req.file ? req.file.path : null;

  // Insert article data into the database
  db('article')
    .insert({
      headline: headline,
      author: author,
      subheader: subHeader,
      articlecontent: content,
      content_img: contentImgPath
    })
    .returning('*')
    .then(article => {
      res.json(article[0]);
    })
    .catch(err => {
      console.error('Error saving article:', err);
      res.status(500).json('Error saving article');
    });
});
*/
app.post('/PostArticles', upload.single('content_img'), (req, res) => {
  const { headline, author, subHeader, content } = req.body;
  const contentImgPath = req.file ? req.file.path : null;
  // Read the image file as binary data
  const contentImgData = contentImgPath ? fs.readFileSync(contentImgPath) : null;
  // Insert article data into the database
  db('article')
    .insert({
      headline,
      author,
      subheader: subHeader,
      articlecontent: content,
      content_img: contentImgData // Store the binary image data
    })
    .returning('*')
    .then(article => {
      res.json(article[0]);
    })
    .catch(err => {
      console.error('Error saving article:', err);
      res.status(500).json('Error saving article');
    });
});


app.post('/AddLandlord', (req, res) => {
  const { email, name, password, phone } = req.body;
  const hash = bcrypt.hashSync(password);
  db.transaction(trx => {
    trx.insert({
      hash: hash,
      email: email
    })
      .into('landlordlogin')
      .returning('email')
      .then(loginEmail => {
        return trx('landlord')
          .returning('*')
          .insert({
            email: loginEmail[0].email,
            name: name,
            phone: phone
          })
          .then(user => {
            res.json(user[0]);
          })
      })
      .then(trx.commit)
      .catch(trx.rollback)
  })
    .catch(err => res.status(400).json('unable to register'))
})

app.post('/AddWarden', (req, res) => {
  const { email, name, password, phone } = req.body;
  const hash = bcrypt.hashSync(password);
  db.transaction(trx => {
    trx.insert({
      hash: hash,
      email: email
    })
      .into('wardenlogin')
      .returning('email')
      .then(loginEmail => {
        return trx('warden')
          .returning('*')
          .insert({
            email: loginEmail[0].email,
            name: name,
            phone: phone
          })
          .then(user => {
            res.json(user[0]);
          })
      })
      .then(trx.commit)
      .catch(trx.rollback)
  })
    .catch(err => res.status(400).json('unable to register'))
})

app.post('/AddStudent', (req, res) => {
  const { email, name, password, phone } = req.body;
  const hash = bcrypt.hashSync(password);
  db.transaction(trx => {
    trx.insert({
      hash: hash,
      email: email
    })
      .into('login')
      .returning('email')
      .then(loginEmail => {
        return trx('student')
          .returning('*')
          .insert({
            email: loginEmail[0].email,
            name: name,
            phone: phone
          })
          .then(user => {
            res.json(user[0]);
          })
      })
      .then(trx.commit)
      .catch(trx.rollback)
  })
    .catch(err => res.status(400).json('unable to register'))
})

// Add a route to fetch admin profile data by email
app.get('/AdminProfile/:email', (req, res) => {
  const { email } = req.params;
  // Query the database to fetch admin profile data by email
  db.select('*').from('admin').where({ email })
    .then(admin => {
      if (admin.length > 0) {
        res.json(admin[0]);
      } else {
        res.status(404).json({ error: 'Admin not found' });
      }
    })
    .catch(error => {
      console.error('Error fetching admin profile:', error);
      res.status(500).json({ error: 'Error fetching admin profile' });
    });
});

// Update Profile
app.put('/AdminProfile/:email', (req, res) => {
  const { email } = req.params; // Access the user's email from URL parameters
  const { name, password, phone } = req.body; // Extract updated profile data from request body

  // Update profile data in the database
  db.transaction(trx => {
    // Update name and phone in the admin table
    trx('admin')
      .where({ email })
      .update({ name, phone })
      .then(() => {
        // Update password in the adminlogin table if provided
        if (password) {
          const hash = bcrypt.hashSync(password);
          trx('adminlogin')
            .where({ email })
            .update({ hash })
            .then(() => {
              res.json({ message: 'Profile updated successfully' });
            })
            .catch(err => {
              console.error('Error updating password:', err);
              res.status(500).json('Error updating password');
            });
        } else {
          res.json({ message: 'Profile updated successfully' });
        }
      })
      .then(trx.commit)
      .catch(trx.rollback);
  })
    .catch(err => {
      console.error('Error updating profile:', err);
      res.status(500).json('Error updating profile');
    });
});
//Admin end


//Warden start
app.post('/WardenLogin', (req, res) => {
  db.select('email', 'hash').from('wardenlogin')
    .where('email', '=', req.body.email)
    .then(data => {
      const isValid = bcrypt.compareSync(req.body.password, data[0].hash);
      if (isValid) {
        return db.select('*').from('warden')
          .where('email', '=', req.body.email)
          .then(user => {
            res.json(user[0])
          })
          .catch(err => res.status(400).json('unable to get user'))
      } else {
        res.status(400).json('wrong credentials')
      }
    })
    .catch(err => res.status(400).json('wrong credentials'))
})

app.get('/WardenProperty', (req, res) => {
  // Query the database to fetch all properties
  db.select('*').from('property')
    .then(properties => {
      res.json(properties);
    })
    .catch(error => {
      console.error('Error fetching properties:', error);
      res.status(500).json({ error: 'Error fetching properties' });
    });
});

app.get('/WardenProperty/:propertyId', (req, res) => {
  const { propertyId } = req.params;
  // Query the database to fetch property details by propertyId
  db.select('*').from('property').where({ id: propertyId })
    .then(property => {
      if (property.length > 0) {
        res.json(property[0]);
      } else {
        res.status(404).json({ error: 'Property not found' });
      }
    })
    .catch(error => {
      console.error('Error fetching property details:', error);
      res.status(500).json({ error: 'Internal server error' });
    });
});

// Add a route to fetch profile data by email
app.get('/WardenProfile/:email', (req, res) => {
  const { email } = req.params;
  // Query the database to fetch admin profile data by email
  db.select('*').from('warden').where({ email })
    .then(admin => {
      if (admin.length > 0) {
        res.json(admin[0]);
      } else {
        res.status(404).json({ error: 'Student not found' });
      }
    })
    .catch(error => {
      console.error('Error fetching admin profile:', error);
      res.status(500).json({ error: 'Error fetching admin profile' });
    });
});

// Update Profile
app.put('/WardenProfile/:email', (req, res) => {
  const { email } = req.params; // Access the user's email from URL parameters
  const { name, password, phone } = req.body; // Extract updated profile data from request body

  // Update profile data in the database
  db.transaction(trx => {
    // Update name and phone in the admin table
    trx('warden')
      .where({ email })
      .update({ name, phone })
      .then(() => {
        // Update password in the adminlogin table if provided
        if (password) {
          const hash = bcrypt.hashSync(password);
          trx('wardenlogin')
            .where({ email })
            .update({ hash })
            .then(() => {
              res.json({ message: 'Profile updated successfully' });
            })
            .catch(err => {
              console.error('Error updating password:', err);
              res.status(500).json('Error updating password');
            });
        } else {
          res.json({ message: 'Profile updated successfully' });
        }
      })
      .then(trx.commit)
      .catch(trx.rollback);
  })
    .catch(err => {
      console.error('Error updating profile:', err);
      res.status(500).json('Error updating profile');
    });
});
//Warden end


//Get Markers Data
app.get('/Markers', (req, res) => {
  // Query the database to fetch all properties
  db.select('*').from('property').where({ status: 'Accept' })
    .then(properties => {
      res.json(properties);
    })
    .catch(error => {
      console.error('Error fetching properties:', error);
      res.status(500).json({ error: 'Error fetching properties' });
    });
});
//Get Markers Data end


//Get Reserve Data
app.get('/Reservations/:email/Reserve', (req, res) => {
  const { email } = req.params; // Access the property ID from URL parameters
  // Query the database to fetch all properties
  db.select('*').from('property').where({ email: email })
    .then(property => {
      res.json(property);
    })
    .catch(error => {
      console.error('Error fetching properties:', error);
      res.status(500).json({ error: 'Error fetching properties' });
    });
});
//Get Reserve Data end


//Get Articles
app.get('/Articles', (req, res) => {
  db.select('headline', 'author', 'content_img').from('article')
    .then(articles => {
      if (articles.length > 0) {
        res.json(articles);
      } else {
        res.status(404).json({ error: 'No articles found' });
      }
    })
    .catch(error => {
      console.error('Error fetching articles:', error);
      res.status(500).json({ error: 'Internal server error' });
    });
});
//Get Articles end


app.get('/profile/:id', (req, res) => {
  const { id } = req.params;
  db.select('*').from('users').where({ id })
    .then(user => {
      if (user.length) {
        res.json(user[0])
      } else {
        res.status(400).json('Not found')
      }
    })
    .catch(err => res.status(400).json('error getting user'))
})

//Accept Property
app.put('/WardenProperty/:id/Accept', (req, res) => {
  const { id } = req.params; // Access the property ID from URL parameters

  db('property')
    .where({ id: id })
    .update({ status: 'Accept' }) // Update the status to 'Accept'
    .returning('status')
    .then(status => {
      res.json(status[0]); // Return the updated status
    })
    .catch(err => res.status(400).json('Unable to update property status')); // Handle errors
});
//Accept Property end

//Reserve 
app.put('/WardenProperty/:id/:email/Reserve', (req, res) => {
  const { id, email } = req.params; // Access the property ID from URL parameters

  db('property')
    .where({ id: id })
    .update({ email: email }) // Update the email to 'email'
    .returning('email')
    .then(email => {
      res.json(email[0]); // Return the updated email
    })
    .catch(err => res.status(400).json('Unable to update property status')); // Handle errors
});
//Reserve


//Reject Property
app.put('/WardenProperty/:id/Reject', (req, res) => {
  const { id } = req.params; // Access the property ID from URL parameters

  db('property')
    .where({ id: id })
    .update({ status: 'Reject' }) // Update the status to 'Reject'
    .returning('status')
    .then(status => {
      res.json(status[0]); // Return the updated status
    })
    .catch(err => res.status(400).json('Unable to update property status')); // Handle errors
});
//Reject Property end


// Delete Property
app.delete('/LandlordReservations/:id/Delete', (req, res) => {
  const { id } = req.params; // Access the property ID from URL parameters

  db('property')
    .where({ id: id })
    .del() // Delete the property
    .then(() => {
      res.json({ message: 'Property deleted successfully' });
    })
    .catch(err => res.status(400).json('Unable to delete property')); // Handle errors
});
//Delete Proprety end

app.listen(3000, () => {
  console.log('app is running on port 3000');
})
