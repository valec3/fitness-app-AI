const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const fs = require("fs");

/**
 * Clase para manejar la base de datos SQLite
 * Almacena entradas de comidas y ejercicios procesadas
 */
class Database {
  constructor() {
    this.dbPath =
      process.env.DB_PATH || path.join(__dirname, "data", "nutrition.db");
    this.db = null;
  }

  /**
   * Inicializa la base de datos y crea las tablas necesarias
   */
  async initialize() {
    return new Promise((resolve, reject) => {
      try {
        // Crear directorio de datos si no existe
        const dataDir = path.dirname(this.dbPath);
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }

        // Conectar a la base de datos
        this.db = new sqlite3.Database(this.dbPath, (err) => {
          if (err) {
            console.error("❌ Error conectando a SQLite:", err);
            reject(err);
            return;
          }
          console.log("✅ Conectado a la base de datos SQLite");
        });

        // Crear tablas
        this.createTables()
          .then(() => {
            console.log("✅ Tablas de base de datos inicializadas");
            resolve();
          })
          .catch(reject);
      } catch (error) {
        reject(error);
      }
    });
  }

  /**
   * Crea las tablas necesarias en la base de datos
   */
  async createTables() {
    return new Promise((resolve, reject) => {
      // Tabla principal para entradas
      const createEntriesTable = `
        CREATE TABLE IF NOT EXISTS entries (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          timestamp TEXT NOT NULL,
          raw_text TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP
        )
      `;

      // Tabla para alimentos
      const createFoodsTable = `
        CREATE TABLE IF NOT EXISTS foods (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entry_id INTEGER,
          name TEXT NOT NULL,
          quantity TEXT,
          calories INTEGER,
          protein REAL,
          carbs REAL,
          fat REAL,
          fiber REAL,
          FOREIGN KEY (entry_id) REFERENCES entries (id) ON DELETE CASCADE
        )
      `;

      // Tabla para ejercicios
      const createExercisesTable = `
        CREATE TABLE IF NOT EXISTS exercises (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          entry_id INTEGER,
          type TEXT NOT NULL,
          duration TEXT,
          intensity TEXT,
          calories_burned INTEGER,
          FOREIGN KEY (entry_id) REFERENCES entries (id) ON DELETE CASCADE
        )
      `;

      // Ejecutar creación de tablas en secuencia
      this.db.serialize(() => {
        this.db.run(createEntriesTable);
        this.db.run(createFoodsTable);
        this.db.run(createExercisesTable, (err) => {
          if (err) {
            reject(err);
          } else {
            resolve();
          }
        });
      });
    });
  }

  /**
   * Verifica si la base de datos está conectada y lista
   * @returns {boolean} true si está conectada
   */
  isConnected() {
    return this.db !== null && this.db !== undefined;
  }

  /**
   * Guarda una nueva entrada con alimentos y ejercicios
   * @param {Object} data - Datos procesados por Gemini AI
   * @returns {Promise<number>} ID de la entrada creada
   */
  async saveEntry(data) {
    return new Promise((resolve, reject) => {
      // Verificar que la base de datos esté inicializada
      if (!this.db) {
        console.error("❌ Base de datos no inicializada en saveEntry");
        console.error("❌ Estado de this.db:", this.db);
        console.error("❌ Tipo de this.db:", typeof this.db);
        reject(new Error(`Base de datos no inicializada - Estado: ${this.db}`));
        return;
      }

      const { foods = [], exercises = [], timestamp, raw_text } = data;

      // Insertar entrada principal
      const insertEntry = `
        INSERT INTO entries (timestamp, raw_text)
        VALUES (?, ?)
      `;

      // Guardar referencia a this.db para usar en callbacks
      const dbRef = this.db;

      this.db.run(insertEntry, [timestamp, raw_text], function (err) {
        if (err) {
          reject(err);
          return;
        }

        // Usar this.lastID que se refiere al statement SQLite
        const entryId = this.lastID;
        console.log("✅ Entry creado con ID:", entryId);

        // Insertar alimentos
        const insertFood = `
          INSERT INTO foods (entry_id, name, quantity, calories, protein, carbs, fat, fiber)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;

        // Insertar ejercicios
        const insertExercise = `
          INSERT INTO exercises (entry_id, type, duration, intensity, calories_burned)
          VALUES (?, ?, ?, ?, ?)
        `;

        const insertPromises = [];

        // Insertar cada alimento
        foods.forEach((food) => {
          insertPromises.push(
            new Promise((resolveFood, rejectFood) => {
              if (!dbRef) {
                console.error("❌ dbRef no disponible en forEach alimento");
                rejectFood(new Error("Base de datos no disponible"));
                return;
              }

              const nutrition = food.nutrition || {};
              console.log(
                "🍽️ Insertando alimento:",
                food.name,
                "para entry_id:",
                entryId
              );

              dbRef.run(
                insertFood,
                [
                  entryId,
                  food.name,
                  food.quantity,
                  food.calories,
                  nutrition.protein,
                  nutrition.carbs,
                  nutrition.fat,
                  nutrition.fiber,
                ],
                (err) => {
                  if (err) {
                    console.error("❌ Error insertando alimento:", err);
                    rejectFood(err);
                  } else {
                    console.log("✅ Alimento insertado:", food.name);
                    resolveFood();
                  }
                }
              );
            })
          );
        });

        // Insertar cada ejercicio
        exercises.forEach((exercise) => {
          insertPromises.push(
            new Promise((resolveExercise, rejectExercise) => {
              if (!dbRef) {
                console.error("❌ dbRef no disponible en forEach ejercicio");
                rejectExercise(new Error("Base de datos no disponible"));
                return;
              }

              console.log(
                "🏃‍♂️ Insertando ejercicio:",
                exercise.type,
                "para entry_id:",
                entryId
              );

              dbRef.run(
                insertExercise,
                [
                  entryId,
                  exercise.type,
                  exercise.duration,
                  exercise.intensity,
                  exercise.calories_burned,
                ],
                (err) => {
                  if (err) {
                    console.error("❌ Error insertando ejercicio:", err);
                    rejectExercise(err);
                  } else {
                    console.log("✅ Ejercicio insertado:", exercise.type);
                    resolveExercise();
                  }
                }
              );
            })
          );
        });

        // Esperar a que todas las inserciones terminen
        Promise.all(insertPromises)
          .then(() => resolve(entryId))
          .catch(reject);
      });
    });
  }

  /**
   * Obtiene todas las entradas con sus alimentos y ejercicios
   * @returns {Promise<Array>} Array de entradas completas
   */
  async getAllEntries() {
    return new Promise((resolve, reject) => {
      // Verificar que la base de datos esté inicializada
      if (!this.db) {
        reject(new Error("Base de datos no inicializada"));
        return;
      }

      const query = `
        SELECT e.id, e.timestamp, e.raw_text, e.created_at
        FROM entries e
        ORDER BY e.created_at DESC
      `;

      this.db.all(query, [], async (err, entries) => {
        if (err) {
          reject(err);
          return;
        }

        try {
          // Obtener alimentos y ejercicios para cada entrada
          const entriesWithDetails = await Promise.all(
            entries.map(async (entry) => {
              const foods = await this.getFoodsForEntry(entry.id);
              const exercises = await this.getExercisesForEntry(entry.id);

              return {
                ...entry,
                foods,
                exercises,
              };
            })
          );

          resolve(entriesWithDetails);
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Obtiene una entrada específica por ID
   * @param {number} entryId - ID de la entrada
   * @returns {Promise<Object>} Entrada completa con alimentos y ejercicios
   */
  async getEntry(entryId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT e.id, e.timestamp, e.raw_text, e.created_at
        FROM entries e
        WHERE e.id = ?
      `;

      this.db.get(query, [entryId], async (err, entry) => {
        if (err) {
          reject(err);
          return;
        }

        if (!entry) {
          resolve(null);
          return;
        }

        try {
          const foods = await this.getFoodsForEntry(entry.id);
          const exercises = await this.getExercisesForEntry(entry.id);

          resolve({
            ...entry,
            foods,
            exercises,
          });
        } catch (error) {
          reject(error);
        }
      });
    });
  }

  /**
   * Obtiene alimentos para una entrada específica
   * @param {number} entryId - ID de la entrada
   * @returns {Promise<Array>} Array de alimentos
   */
  async getFoodsForEntry(entryId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT name, quantity, calories, protein, carbs, fat, fiber
        FROM foods
        WHERE entry_id = ?
      `;

      this.db.all(query, [entryId], (err, foods) => {
        if (err) {
          reject(err);
        } else {
          // Formatear datos nutricionales
          const formattedFoods = foods.map((food) => ({
            name: food.name,
            quantity: food.quantity,
            calories: food.calories,
            nutrition: {
              protein: food.protein,
              carbs: food.carbs,
              fat: food.fat,
              fiber: food.fiber,
            },
          }));
          resolve(formattedFoods);
        }
      });
    });
  }

  /**
   * Obtiene ejercicios para una entrada específica
   * @param {number} entryId - ID de la entrada
   * @returns {Promise<Array>} Array de ejercicios
   */
  async getExercisesForEntry(entryId) {
    return new Promise((resolve, reject) => {
      const query = `
        SELECT type, duration, intensity, calories_burned
        FROM exercises
        WHERE entry_id = ?
      `;

      this.db.all(query, [entryId], (err, exercises) => {
        if (err) {
          reject(err);
        } else {
          resolve(exercises);
        }
      });
    });
  }

  /**
   * Obtiene estadísticas de resumen
   * @returns {Promise<Object>} Estadísticas de la base de datos
   */
  async getStats() {
    return new Promise((resolve, reject) => {
      const statsQuery = `
        SELECT 
          COUNT(DISTINCT e.id) as total_entries,
          COUNT(f.id) as total_foods,
          COUNT(ex.id) as total_exercises,
          SUM(f.calories) as total_calories_consumed,
          SUM(ex.calories_burned) as total_calories_burned
        FROM entries e
        LEFT JOIN foods f ON e.id = f.entry_id
        LEFT JOIN exercises ex ON e.id = ex.entry_id
      `;

      this.db.get(statsQuery, [], (err, stats) => {
        if (err) {
          reject(err);
        } else {
          resolve(stats);
        }
      });
    });
  }

  /**
   * Cierra la conexión a la base de datos
   */
  async close() {
    return new Promise((resolve, reject) => {
      if (this.db) {
        this.db.close((err) => {
          if (err) {
            reject(err);
          } else {
            console.log("✅ Conexión a SQLite cerrada");
            resolve();
          }
        });
      } else {
        resolve();
      }
    });
  }

  /**
   * Limpia todas las tablas de la base de datos (útil para debugging)
   */
  async clearAllTables() {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        reject(new Error("Base de datos no inicializada"));
        return;
      }

      this.db.serialize(() => {
        this.db.run("DELETE FROM exercises", (err) => {
          if (err) console.error("Error limpiando exercises:", err);
        });
        this.db.run("DELETE FROM foods", (err) => {
          if (err) console.error("Error limpiando foods:", err);
        });
        this.db.run("DELETE FROM entries", (err) => {
          if (err) {
            console.error("Error limpiando entries:", err);
            reject(err);
          } else {
            console.log("✅ Todas las tablas limpiadas");
            resolve();
          }
        });
      });
    });
  }

  /**
   * Elimina una entrada y todos sus datos relacionados
   * @param {number} entryId - ID de la entrada a eliminar
   * @returns {Promise<boolean>} True si se eliminó correctamente
   */
  async deleteEntry(entryId) {
    return new Promise((resolve, reject) => {
      const deleteQuery = "DELETE FROM entries WHERE id = ?";

      this.db.run(deleteQuery, [entryId], function (err) {
        if (err) {
          reject(err);
        } else {
          resolve(this.changes > 0);
        }
      });
    });
  }
}

module.exports = Database;
