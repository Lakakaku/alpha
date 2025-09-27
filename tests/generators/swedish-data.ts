/**
 * Swedish Test Data Generators
 * Generates realistic Swedish data for testing using Faker.js
 */

import { faker } from '@faker-js/faker';

// Configure faker for Swedish locale
faker.setLocale('sv');

export interface SwedishCustomer {
  id: string;
  phone: string;
  firstName: string;
  lastName: string;
  email: string;
  address: SwedishAddress;
  personalNumber?: string; // Optional Swedish personal number (personnummer)
  createdAt: Date;
}

export interface SwedishBusiness {
  id: string;
  name: string;
  orgNumber: string; // Swedish organization number
  vatNumber: string; // Swedish VAT number
  contactEmail: string;
  contactPhone: string;
  address: SwedishAddress;
  industry: string;
  employeeCount: number;
  createdAt: Date;
}

export interface SwedishStore {
  id: string;
  name: string;
  businessId: string;
  storeNumber: string;
  address: SwedishAddress;
  coordinates: {
    lat: number;
    lng: number;
  };
  openingHours: SwedishOpeningHours;
  storeType: string;
  createdAt: Date;
}

export interface SwedishAddress {
  street: string;
  streetNumber: string;
  postalCode: string;
  city: string;
  county: string; // Swedish län
  country: string;
}

export interface SwedishOpeningHours {
  monday: string;
  tuesday: string;
  wednesday: string;
  thursday: string;
  friday: string;
  saturday: string;
  sunday: string;
}

export interface SwedishFeedback {
  id: string;
  customerId: string;
  storeId: string;
  rating: number; // 1-5
  comment: string; // In Swedish
  categories: string[];
  sentiment: 'positive' | 'neutral' | 'negative';
  language: 'sv-SE';
  submittedAt: Date;
}

export interface SwedishAdmin {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'admin' | 'super_admin' | 'support';
  permissions: string[];
  lastLoginAt?: Date;
  createdAt: Date;
}

/**
 * Swedish Names Data
 */
const SWEDISH_FIRST_NAMES = {
  male: [
    'Lars', 'Mikael', 'Anders', 'Johan', 'Erik', 'Per', 'Karl', 'Nils', 'Lennart', 'Hans',
    'Sven', 'Jan', 'Bengt', 'Bo', 'Ulf', 'Rolf', 'Mats', 'Leif', 'Gunnar', 'Stefan',
    'William', 'Lucas', 'Liam', 'Noah', 'Oliver', 'Hugo', 'Theo', 'Leon', 'Isak', 'Emil'
  ],
  female: [
    'Anna', 'Eva', 'Maria', 'Karin', 'Sara', 'Christina', 'Lena', 'Emma', 'Kerstin', 'Marie',
    'Birgitta', 'Helen', 'Margareta', 'Elisabeth', 'Monica', 'Ingrid', 'Susanne', 'Annika',
    'Alice', 'Maja', 'Elsa', 'Olivia', 'Astrid', 'Ebba', 'Wilma', 'Alma', 'Stella', 'Clara'
  ]
};

const SWEDISH_LAST_NAMES = [
  'Andersson', 'Johansson', 'Karlsson', 'Nilsson', 'Eriksson', 'Larsson', 'Olsson', 'Persson',
  'Svensson', 'Gustafsson', 'Pettersson', 'Jonsson', 'Jansson', 'Hansson', 'Bengtsson',
  'Jönsson', 'Lindberg', 'Jakobsson', 'Magnusson', 'Olofsson', 'Lindström', 'Lindqvist',
  'Lundberg', 'Fredriksson', 'Mattsson', 'Berglund', 'Henriksson', 'Sandberg', 'Forsberg'
];

/**
 * Swedish Business Types and Industries
 */
const SWEDISH_BUSINESS_TYPES = [
  'Aktiebolag (AB)', 'Handelsbolag (HB)', 'Kommanditbolag (KB)', 'Ekonomisk förening',
  'Ideell förening', 'Enskild firma', 'Partnerskap'
];

const SWEDISH_INDUSTRIES = [
  'Detaljhandel', 'Grosshandel', 'Restaurang och hotell', 'Bygg och anläggning',
  'Transport och logistik', 'IT och telekom', 'Hälso- och sjukvård', 'Utbildning',
  'Tillverkning', 'Finansiella tjänster', 'Konsulttjänster', 'Försäkring'
];

/**
 * Swedish Store Types
 */
const SWEDISH_STORE_TYPES = [
  'Livsmedelsbutik', 'Klädbutik', 'Elektronikbutik', 'Apotek', 'Bokhandel',
  'Blomsterbutik', 'Sportbutik', 'Leksaksbutik', 'Musikaffär', 'Optik'
];

/**
 * Swedish Cities and Counties
 */
const SWEDISH_CITIES_BY_COUNTY = {
  'Stockholm': ['Stockholm', 'Sollentuna', 'Nacka', 'Sundbyberg', 'Solna', 'Täby', 'Lidingö'],
  'Göteborg': ['Göteborg', 'Mölndal', 'Partille', 'Lerum', 'Kungsbacka', 'Härryda'],
  'Malmö': ['Malmö', 'Lund', 'Helsingborg', 'Landskrona', 'Eslöv', 'Höganäs'],
  'Uppsala': ['Uppsala', 'Enköping', 'Håbo', 'Älvkarleby', 'Tierp', 'Östhammar'],
  'Västerås': ['Västerås', 'Eskilstuna', 'Köping', 'Arboga', 'Kungsör', 'Hallstahammar'],
  'Örebro': ['Örebro', 'Kumla', 'Hallsberg', 'Degerfors', 'Askersund', 'Karlskoga'],
};

/**
 * Swedish Feedback Comments (Positive/Negative)
 */
const SWEDISH_FEEDBACK_COMMENTS = {
  positive: [
    'Fantastisk service och mycket vänlig personal!',
    'Bra priser och stort utbud. Kommer definitivt tillbaka.',
    'Snabb service och bra kvalitet på produkterna.',
    'Mycket nöjd med köpet. Rekommenderar starkt!',
    'Professionell behandling och hjälpsam personal.',
    'Utmärkt kundservice och problemlösning.',
    'Bra öppettider och alltid rent och snyggt.',
    'Personalen var mycket kunnig och hjälpsam.',
  ],
  neutral: [
    'Okej service, inget särskilt att anmärka på.',
    'Genomsnittlig upplevelse, varken bra eller dålig.',
    'Produkterna var som förväntat.',
    'Standard service, fick det jag kom för.',
    'Vanlig butik, inget som sticker ut.',
    'Fungerar bra för vardagshandel.',
  ],
  negative: [
    'Mycket långsam service och långa köer.',
    'Dålig kundservice och oprofessionell personal.',
    'Dyrare än andra butiker i området.',
    'Begränsat utbud och ofta slutsålda varor.',
    'Opersonlig behandling och dålig stämning.',
    'Problem med betalning och kassan fungerade dåligt.',
    'Smutsigt och ostädat, inte bra intryck.',
  ]
};

/**
 * Generator Classes
 */
export class SwedishCustomerGenerator {
  static generate(overrides: Partial<SwedishCustomer> = {}): SwedishCustomer {
    const gender = faker.helpers.arrayElement(['male', 'female']) as 'male' | 'female';
    const firstName = faker.helpers.arrayElement(SWEDISH_FIRST_NAMES[gender]);
    const lastName = faker.helpers.arrayElement(SWEDISH_LAST_NAMES);
    
    return {
      id: faker.datatype.uuid(),
      phone: this.generateSwedishPhone(),
      firstName,
      lastName,
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@${faker.helpers.arrayElement(['gmail.com', 'outlook.com', 'hotmail.com', 'yahoo.se', 'bredband.net'])}`,
      address: SwedishAddressGenerator.generate(),
      personalNumber: this.generatePersonalNumber(),
      createdAt: faker.date.past(2),
      ...overrides
    };
  }

  static generateMany(count: number, overrides: Partial<SwedishCustomer> = {}): SwedishCustomer[] {
    return Array.from({ length: count }, () => this.generate(overrides));
  }

  private static generateSwedishPhone(): string {
    // Swedish mobile format: +46 7X XXX XX XX
    const prefix = '+46 7';
    const secondDigit = faker.helpers.arrayElement(['0', '1', '2', '3', '4', '5', '6', '7', '8']);
    const remaining = faker.datatype.number({ min: 1000000, max: 9999999 }).toString();
    return `${prefix}${secondDigit} ${remaining.slice(0, 3)} ${remaining.slice(3, 5)} ${remaining.slice(5)}`;
  }

  private static generatePersonalNumber(): string {
    // Swedish personal number format: YYMMDD-XXXX
    const year = faker.datatype.number({ min: 40, max: 99 }).toString().padStart(2, '0');
    const month = faker.datatype.number({ min: 1, max: 12 }).toString().padStart(2, '0');
    const day = faker.datatype.number({ min: 1, max: 28 }).toString().padStart(2, '0');
    const suffix = faker.datatype.number({ min: 1000, max: 9999 }).toString();
    return `${year}${month}${day}-${suffix}`;
  }
}

export class SwedishBusinessGenerator {
  static generate(overrides: Partial<SwedishBusiness> = {}): SwedishBusiness {
    const businessName = `${faker.helpers.arrayElement(['Nord', 'Syd', 'Väst', 'Öst', 'Svenska', 'Scan'])} ${faker.helpers.arrayElement(['Handel', 'Service', 'Gruppen', 'Solutions', 'Partners'])} ${faker.helpers.arrayElement(['AB', 'HB', 'KB'])}`;
    
    return {
      id: faker.datatype.uuid(),
      name: businessName,
      orgNumber: this.generateOrgNumber(),
      vatNumber: this.generateVatNumber(),
      contactEmail: `info@${faker.internet.domainName()}`,
      contactPhone: SwedishCustomerGenerator['generateSwedishPhone'](),
      address: SwedishAddressGenerator.generate(),
      industry: faker.helpers.arrayElement(SWEDISH_INDUSTRIES),
      employeeCount: faker.datatype.number({ min: 1, max: 1000 }),
      createdAt: faker.date.past(5),
      ...overrides
    };
  }

  static generateMany(count: number, overrides: Partial<SwedishBusiness> = {}): SwedishBusiness[] {
    return Array.from({ length: count }, () => this.generate(overrides));
  }

  private static generateOrgNumber(): string {
    // Swedish organization number format: XXXXXX-XXXX
    const first6 = faker.datatype.number({ min: 100000, max: 999999 }).toString();
    const last4 = faker.datatype.number({ min: 1000, max: 9999 }).toString();
    return `${first6}-${last4}`;
  }

  private static generateVatNumber(): string {
    // Swedish VAT number format: SE + org number + 01
    const orgBase = faker.datatype.number({ min: 100000000, max: 999999999 }).toString();
    return `SE${orgBase}01`;
  }
}

export class SwedishStoreGenerator {
  static generate(overrides: Partial<SwedishStore> = {}): SwedishStore {
    const storeType = faker.helpers.arrayElement(SWEDISH_STORE_TYPES);
    const storeName = `${faker.helpers.arrayElement(['ICA', 'Coop', 'Hemköp', 'Willys', 'City Gross'])} ${storeType}`;
    
    return {
      id: faker.datatype.uuid(),
      name: storeName,
      businessId: faker.datatype.uuid(),
      storeNumber: faker.datatype.number({ min: 1001, max: 9999 }).toString(),
      address: SwedishAddressGenerator.generate(),
      coordinates: this.generateSwedishCoordinates(),
      openingHours: this.generateOpeningHours(),
      storeType,
      createdAt: faker.date.past(3),
      ...overrides
    };
  }

  static generateMany(count: number, overrides: Partial<SwedishStore> = {}): SwedishStore[] {
    return Array.from({ length: count }, () => this.generate(overrides));
  }

  private static generateSwedishCoordinates(): { lat: number; lng: number } {
    // Swedish coordinate bounds
    return {
      lat: faker.datatype.float({ min: 55.0, max: 69.0, precision: 0.000001 }),
      lng: faker.datatype.float({ min: 10.0, max: 24.0, precision: 0.000001 })
    };
  }

  private static generateOpeningHours(): SwedishOpeningHours {
    return {
      monday: '08:00-20:00',
      tuesday: '08:00-20:00',
      wednesday: '08:00-20:00',
      thursday: '08:00-20:00',
      friday: '08:00-20:00',
      saturday: '09:00-18:00',
      sunday: '10:00-18:00',
    };
  }
}

export class SwedishAddressGenerator {
  static generate(): SwedishAddress {
    const counties = Object.keys(SWEDISH_CITIES_BY_COUNTY);
    const county = faker.helpers.arrayElement(counties);
    const city = faker.helpers.arrayElement(SWEDISH_CITIES_BY_COUNTY[county]);
    
    const streetNames = [
      'Storgatan', 'Kungsgatan', 'Drottninggatan', 'Västergatan', 'Östergatan',
      'Nygatan', 'Järnvägsgatan', 'Skolvägen', 'Kyrkovägen', 'Parkvägen'
    ];
    
    return {
      street: faker.helpers.arrayElement(streetNames),
      streetNumber: faker.datatype.number({ min: 1, max: 999 }).toString(),
      postalCode: this.generatePostalCode(),
      city,
      county,
      country: 'Sverige'
    };
  }

  private static generatePostalCode(): string {
    // Swedish postal code format: XXX XX
    const digits = faker.datatype.number({ min: 10000, max: 99999 }).toString();
    return `${digits.slice(0, 3)} ${digits.slice(3)}`;
  }
}

export class SwedishFeedbackGenerator {
  static generate(overrides: Partial<SwedishFeedback> = {}): SwedishFeedback {
    const sentiment = faker.helpers.arrayElement(['positive', 'neutral', 'negative'] as const);
    const rating = this.getRatingBySentiment(sentiment);
    
    return {
      id: faker.datatype.uuid(),
      customerId: faker.datatype.uuid(),
      storeId: faker.datatype.uuid(),
      rating,
      comment: faker.helpers.arrayElement(SWEDISH_FEEDBACK_COMMENTS[sentiment]),
      categories: this.generateCategories(),
      sentiment,
      language: 'sv-SE',
      submittedAt: faker.date.past(1),
      ...overrides
    };
  }

  static generateMany(count: number, overrides: Partial<SwedishFeedback> = {}): SwedishFeedback[] {
    return Array.from({ length: count }, () => this.generate(overrides));
  }

  private static getRatingBySentiment(sentiment: 'positive' | 'neutral' | 'negative'): number {
    switch (sentiment) {
      case 'positive':
        return faker.datatype.number({ min: 4, max: 5 });
      case 'neutral':
        return 3;
      case 'negative':
        return faker.datatype.number({ min: 1, max: 2 });
    }
  }

  private static generateCategories(): string[] {
    const allCategories = ['service', 'kvalitet', 'pris', 'sortiment', 'miljö', 'tillgänglighet', 'personal'];
    return faker.helpers.arrayElements(allCategories, faker.datatype.number({ min: 1, max: 3 }));
  }
}

export class SwedishAdminGenerator {
  static generate(overrides: Partial<SwedishAdmin> = {}): SwedishAdmin {
    const gender = faker.helpers.arrayElement(['male', 'female']) as 'male' | 'female';
    const firstName = faker.helpers.arrayElement(SWEDISH_FIRST_NAMES[gender]);
    const lastName = faker.helpers.arrayElement(SWEDISH_LAST_NAMES);
    
    return {
      id: faker.datatype.uuid(),
      email: `${firstName.toLowerCase()}.${lastName.toLowerCase()}@vocilia.se`,
      firstName,
      lastName,
      role: faker.helpers.arrayElement(['admin', 'super_admin', 'support'] as const),
      permissions: this.generatePermissions(),
      lastLoginAt: faker.date.recent(30),
      createdAt: faker.date.past(2),
      ...overrides
    };
  }

  static generateMany(count: number, overrides: Partial<SwedishAdmin> = {}): SwedishAdmin[] {
    return Array.from({ length: count }, () => this.generate(overrides));
  }

  private static generatePermissions(): string[] {
    const allPermissions = [
      'users:read', 'users:write', 'stores:read', 'stores:write',
      'businesses:read', 'businesses:write', 'analytics:read', 'system:admin'
    ];
    return faker.helpers.arrayElements(allPermissions, faker.datatype.number({ min: 2, max: 6 }));
  }
}

/**
 * Master generator for creating complete test datasets
 */
export class SwedishTestDataSet {
  static generateComplete(config: {
    customers: number;
    businesses: number;
    stores: number;
    feedback: number;
    admins: number;
  }) {
    const customers = SwedishCustomerGenerator.generateMany(config.customers);
    const businesses = SwedishBusinessGenerator.generateMany(config.businesses);
    const stores = SwedishStoreGenerator.generateMany(config.stores);
    const feedback = SwedishFeedbackGenerator.generateMany(config.feedback);
    const admins = SwedishAdminGenerator.generateMany(config.admins);

    return {
      customers,
      businesses,
      stores,
      feedback,
      admins,
      metadata: {
        generatedAt: new Date(),
        totalRecords: config.customers + config.businesses + config.stores + config.feedback + config.admins,
        locale: 'sv-SE',
        seed: faker.seed()
      }
    };
  }
}