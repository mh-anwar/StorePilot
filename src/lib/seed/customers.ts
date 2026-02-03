const firstNames = [
  "Emma", "Liam", "Olivia", "Noah", "Ava", "Ethan", "Sophia", "Mason",
  "Isabella", "William", "Mia", "James", "Charlotte", "Benjamin", "Amelia",
  "Lucas", "Harper", "Henry", "Evelyn", "Alexander", "Abigail", "Michael",
  "Emily", "Daniel", "Elizabeth", "Jackson", "Sofia", "Sebastian", "Avery",
  "Aiden", "Ella", "Matthew", "Scarlett", "Samuel", "Grace", "David",
  "Chloe", "Joseph", "Victoria", "Owen", "Riley", "Wyatt", "Aria",
  "John", "Lily", "Jack", "Aurora", "Luke", "Zoey", "Jayden",
  "Nora", "Dylan", "Camila", "Grayson", "Hannah", "Levi", "Addison",
  "Isaac", "Eleanor", "Gabriel", "Stella", "Julian", "Natalie", "Anthony",
  "Zoe", "Jaxon", "Leah", "Lincoln", "Hazel", "Joshua", "Violet",
  "Christopher", "Aurora", "Andrew", "Savannah", "Theodore", "Audrey",
  "Caleb", "Brooklyn", "Ryan", "Bella", "Asher", "Claire", "Nathan",
  "Skylar", "Thomas", "Lucy", "Leo", "Paisley", "Isaiah", "Everly",
  "Charles", "Anna", "Josiah", "Caroline", "Hudson", "Nova", "Christian",
  "Genesis", "Hunter", "Emilia", "Connor", "Kennedy", "Eli", "Samantha",
  "Ezra", "Maya", "Aaron", "Willow", "Landon", "Kinsley", "Adrian",
  "Naomi", "Jonathan", "Aaliyah", "Nolan", "Elena", "Jeremiah", "Sarah",
  "Easton", "Ariana", "Elias", "Allison", "Colton", "Gabriella", "Cameron",
  "Alice", "Carson", "Madelyn", "Robert", "Cora", "Angel", "Ruby",
  "Maverick", "Eva", "Nicholas", "Serenity", "Dominic", "Autumn", "Jace",
  "Adeline", "Cooper", "Hailey", "Ian", "Gianna", "Austin", "Valentina",
  "Jason", "Isla", "Adam", "Eliana", "Xavier", "Quinn", "Jose",
  "Nevaeh", "Everett", "Ivy", "Jordan", "Sadie", "Kai", "Piper",
  "Wesley", "Lydia", "Miles", "Alexa", "Braxton", "Josephine", "Parker",
  "Emery", "Bryson", "Julia", "Blake", "Delilah",
];

const lastNames = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller",
  "Davis", "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez",
  "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
  "Lee", "Perez", "Thompson", "White", "Harris", "Sanchez", "Clark",
  "Ramirez", "Lewis", "Robinson", "Walker", "Young", "Allen", "King",
  "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores", "Green",
  "Adams", "Nelson", "Baker", "Hall", "Rivera", "Campbell", "Mitchell",
  "Carter", "Roberts", "Chen", "Kim", "Park", "Patel", "Shah",
  "Singh", "Kumar", "Das", "Gupta", "Tanaka", "Yamamoto", "Sato",
  "Muller", "Schmidt", "Schneider", "Fischer", "Weber", "Meyer", "Wagner",
];

const states = [
  { state: "California", city: "Los Angeles" },
  { state: "California", city: "San Francisco" },
  { state: "New York", city: "New York" },
  { state: "New York", city: "Brooklyn" },
  { state: "Texas", city: "Austin" },
  { state: "Texas", city: "Houston" },
  { state: "Texas", city: "Dallas" },
  { state: "Florida", city: "Miami" },
  { state: "Florida", city: "Orlando" },
  { state: "Illinois", city: "Chicago" },
  { state: "Washington", city: "Seattle" },
  { state: "Colorado", city: "Denver" },
  { state: "Massachusetts", city: "Boston" },
  { state: "Oregon", city: "Portland" },
  { state: "Georgia", city: "Atlanta" },
  { state: "Pennsylvania", city: "Philadelphia" },
  { state: "Arizona", city: "Phoenix" },
  { state: "Tennessee", city: "Nashville" },
  { state: "North Carolina", city: "Charlotte" },
  { state: "Michigan", city: "Detroit" },
];

function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807 + 0) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

export function generateCustomers(count: number = 200) {
  const rand = seededRandom(42);
  const customers = [];
  const usedEmails = new Set<string>();

  for (let i = 0; i < count; i++) {
    const firstName =
      firstNames[Math.floor(rand() * firstNames.length)];
    const lastName =
      lastNames[Math.floor(rand() * lastNames.length)];
    const location = states[Math.floor(rand() * states.length)];

    let email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}@example.com`;
    let counter = 1;
    while (usedEmails.has(email)) {
      email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${counter}@example.com`;
      counter++;
    }
    usedEmails.add(email);

    const phone = `+1${String(Math.floor(rand() * 900 + 100))}${String(
      Math.floor(rand() * 900 + 100)
    )}${String(Math.floor(rand() * 9000 + 1000))}`;

    const tagOptions = ["vip", "newsletter", "repeat", "wholesale", "influencer"];
    const tags: string[] = [];
    if (rand() < 0.1) tags.push("vip");
    if (rand() < 0.4) tags.push("newsletter");
    if (rand() < 0.25) tags.push("repeat");

    customers.push({
      firstName,
      lastName,
      email,
      phone,
      city: location.city,
      state: location.state,
      country: "US" as const,
      tags,
    });
  }

  return customers;
}
