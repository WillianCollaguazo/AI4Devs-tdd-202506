// Mock de multer - debe ir antes de las importaciones
const mockMulter = jest.fn().mockImplementation(() => ({
  single: jest.fn().mockReturnValue((req: any, res: any, next: any) => {
    if (req.body.error) {
      next(new Error(req.body.error));
    } else {
      req.file = {
        path: '/uploads/test-file.pdf',
        mimetype: 'application/pdf',
        originalname: 'test-file.pdf'
      };
      next();
    }
  })
}));

// Agregar propiedades estáticas al mock
Object.defineProperty(mockMulter, 'diskStorage', {
  value: jest.fn().mockReturnValue({}),
  writable: true
});

Object.defineProperty(mockMulter, 'MulterError', {
  value: class MulterError extends Error {
    constructor(message: string) {
      super(message);
      this.name = 'MulterError';
    }
  },
  writable: true
});

jest.mock('multer', () => mockMulter);

import { Request, Response } from 'express';
import { PrismaClient } from '@prisma/client';
import { validateCandidateData } from '../application/validator';
import { Candidate } from '../domain/models/Candidate';
import { Education } from '../domain/models/Education';
import { WorkExperience } from '../domain/models/WorkExperience';
import { Resume } from '../domain/models/Resume';
import { addCandidate } from '../application/services/candidateService';
import { addCandidateController } from '../presentation/controllers/candidateController';
import { uploadFile } from '../application/services/fileUploadService';

// Mock de Prisma
const mockPrisma = {
  candidate: {
    create: jest.fn(),
    update: jest.fn(),
    findUnique: jest.fn(),
  },
  education: {
    create: jest.fn(),
    update: jest.fn(),
  },
  workExperience: {
    create: jest.fn(),
    update: jest.fn(),
  },
  resume: {
    create: jest.fn(),
  },
};

jest.mock('@prisma/client', () => ({
  PrismaClient: jest.fn().mockImplementation(() => mockPrisma),
  Prisma: {
    PrismaClientInitializationError: class PrismaClientInitializationError extends Error {},
  },
}));

// Exportar mock para uso en tests
export { mockPrisma };



describe('Validator Tests', () => {
  describe('validateCandidateData', () => {
    it('should validate valid candidate data', () => {
      const validData = {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@email.com',
        phone: '612345678',
        address: 'Calle Mayor 123'
      };

      expect(() => validateCandidateData(validData)).not.toThrow();
    });

    it('should throw error for invalid first name', () => {
      const invalidData = {
        firstName: 'J', // Too short
        lastName: 'Pérez',
        email: 'juan.perez@email.com'
      };

      expect(() => validateCandidateData(invalidData)).toThrow('Invalid name');
    });

    it('should throw error for invalid first name with numbers', () => {
      const invalidData = {
        firstName: 'Juan123',
        lastName: 'Pérez',
        email: 'juan.perez@email.com'
      };

      expect(() => validateCandidateData(invalidData)).toThrow('Invalid name');
    });

    it('should throw error for invalid email', () => {
      const invalidData = {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'invalid-email'
      };

      expect(() => validateCandidateData(invalidData)).toThrow('Invalid email');
    });

    it('should throw error for invalid phone number', () => {
      const invalidData = {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@email.com',
        phone: '123456789' // Invalid format
      };

      expect(() => validateCandidateData(invalidData)).toThrow('Invalid phone');
    });

    it('should accept valid phone number starting with 6', () => {
      const validData = {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@email.com',
        phone: '612345678'
      };

      expect(() => validateCandidateData(validData)).not.toThrow();
    });

    it('should accept valid phone number starting with 7', () => {
      const validData = {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@email.com',
        phone: '712345678'
      };

      expect(() => validateCandidateData(validData)).not.toThrow();
    });

    it('should accept valid phone number starting with 9', () => {
      const validData = {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@email.com',
        phone: '912345678'
      };

      expect(() => validateCandidateData(validData)).not.toThrow();
    });

    it('should throw error for address too long', () => {
      const longAddress = 'a'.repeat(101);
      const invalidData = {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@email.com',
        address: longAddress
      };

      expect(() => validateCandidateData(invalidData)).toThrow('Invalid address');
    });

    it('should validate education data correctly', () => {
      const validData = {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@email.com',
        educations: [{
          institution: 'Universidad de Madrid',
          title: 'Ingeniero Informático',
          startDate: '2018-09-01',
          endDate: '2022-06-30'
        }]
      };

      expect(() => validateCandidateData(validData)).not.toThrow();
    });

    it('should throw error for invalid education institution', () => {
      const invalidData = {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@email.com',
        educations: [{
          institution: '', // Empty institution
          title: 'Ingeniero Informático',
          startDate: '2018-09-01'
        }]
      };

      expect(() => validateCandidateData(invalidData)).toThrow('Invalid institution');
    });

    it('should throw error for education institution too long', () => {
      const longInstitution = 'a'.repeat(101);
      const invalidData = {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@email.com',
        educations: [{
          institution: longInstitution,
          title: 'Ingeniero Informático',
          startDate: '2018-09-01'
        }]
      };

      expect(() => validateCandidateData(invalidData)).toThrow('Invalid institution');
    });

    it('should throw error for invalid education start date', () => {
      const invalidData = {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@email.com',
        educations: [{
          institution: 'Universidad de Madrid',
          title: 'Ingeniero Informático',
          startDate: 'invalid-date'
        }]
      };

      expect(() => validateCandidateData(invalidData)).toThrow('Invalid date');
    });

    it('should validate work experience data correctly', () => {
      const validData = {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@email.com',
        workExperiences: [{
          company: 'Tech Corp',
          position: 'Software Developer',
          description: 'Desarrollo de aplicaciones web',
          startDate: '2022-01-01',
          endDate: '2023-12-31'
        }]
      };

      expect(() => validateCandidateData(validData)).not.toThrow();
    });

    it('should throw error for invalid work experience company', () => {
      const invalidData = {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@email.com',
        workExperiences: [{
          company: '', // Empty company
          position: 'Software Developer',
          startDate: '2022-01-01'
        }]
      };

      expect(() => validateCandidateData(invalidData)).toThrow('Invalid company');
    });

    it('should throw error for work experience description too long', () => {
      const longDescription = 'a'.repeat(201);
      const invalidData = {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@email.com',
        workExperiences: [{
          company: 'Tech Corp',
          position: 'Software Developer',
          description: longDescription,
          startDate: '2022-01-01'
        }]
      };

      expect(() => validateCandidateData(invalidData)).toThrow('Invalid description');
    });

    it('should validate CV data correctly', () => {
      const validData = {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@email.com',
        cv: {
          filePath: '/uploads/cv.pdf',
          fileType: 'application/pdf'
        }
      };

      expect(() => validateCandidateData(validData)).not.toThrow();
    });

    it('should throw error for invalid CV data', () => {
      const invalidData = {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@email.com',
        cv: {
          filePath: '/uploads/cv.pdf'
          // Missing fileType
        }
      };

      expect(() => validateCandidateData(invalidData)).toThrow('Invalid CV data');
    });

    it('should not validate when id is provided (editing mode)', () => {
      const dataWithId = {
        id: 1,
        firstName: '', // Invalid but should not be validated
        lastName: '',
        email: 'invalid-email'
      };

      expect(() => validateCandidateData(dataWithId)).not.toThrow();
    });
  });
});

describe('Candidate Model Tests', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Candidate constructor', () => {
    it('should create candidate instance with valid data', () => {
      const candidateData = {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@email.com',
        phone: '612345678',
        address: 'Calle Mayor 123'
      };

      const candidate = new Candidate(candidateData);

      expect(candidate.firstName).toBe('Juan');
      expect(candidate.lastName).toBe('Pérez');
      expect(candidate.email).toBe('juan.perez@email.com');
      expect(candidate.phone).toBe('612345678');
      expect(candidate.address).toBe('Calle Mayor 123');
      expect(candidate.education).toEqual([]);
      expect(candidate.workExperience).toEqual([]);
      expect(candidate.resumes).toEqual([]);
    });

    it('should create candidate with education data', () => {
      const candidateData = {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@email.com',
        education: [{
          institution: 'Universidad de Madrid',
          title: 'Ingeniero Informático',
          startDate: '2018-09-01'
        }]
      };

      const candidate = new Candidate(candidateData);

      expect(candidate.education).toHaveLength(1);
      expect(candidate.education[0].institution).toBe('Universidad de Madrid');
    });
  });

  describe('Candidate save method', () => {
    it('should create new candidate successfully', async () => {
      const candidateData = {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@email.com'
      };

      const expectedResult = { id: 1, ...candidateData };
      mockPrisma.candidate.create.mockResolvedValue(expectedResult);

      const candidate = new Candidate(candidateData);
      const result = await candidate.save();

      expect(mockPrisma.candidate.create).toHaveBeenCalledWith({
        data: candidateData
      });
      expect(result).toEqual(expectedResult);
    });

    it('should update existing candidate successfully', async () => {
      const candidateData = {
        id: 1,
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@email.com'
      };

      const expectedResult = { ...candidateData };
      mockPrisma.candidate.update.mockResolvedValue(expectedResult);

      const candidate = new Candidate(candidateData);
      const result = await candidate.save();

      expect(mockPrisma.candidate.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: candidateData
      });
      expect(result).toEqual(expectedResult);
    });

    it('should handle database connection error', async () => {
      const candidateData = {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@email.com'
      };

      const dbError = new Error('Database connection failed');
      dbError.name = 'PrismaClientInitializationError';
      mockPrisma.candidate.create.mockRejectedValue(dbError);

      const candidate = new Candidate(candidateData);

      await expect(candidate.save()).rejects.toThrow(
        'No se pudo conectar con la base de datos. Por favor, asegúrese de que el servidor de base de datos esté en ejecución.'
      );
    });

    it('should handle record not found error on update', async () => {
      const candidateData = {
        id: 1,
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@email.com'
      };

      const notFoundError = new Error('Record not found');
      (notFoundError as any).code = 'P2025';
      mockPrisma.candidate.update.mockRejectedValue(notFoundError);

      const candidate = new Candidate(candidateData);

      await expect(candidate.save()).rejects.toThrow(
        'No se pudo encontrar el registro del candidato con el ID proporcionado.'
      );
    });
  });

  describe('Candidate findOne method', () => {
    it('should find candidate by id', async () => {
      const candidateData = {
        id: 1,
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@email.com'
      };

      mockPrisma.candidate.findUnique.mockResolvedValue(candidateData);

      const result = await Candidate.findOne(1);

      expect(mockPrisma.candidate.findUnique).toHaveBeenCalledWith({
        where: { id: 1 }
      });
      expect(result).toBeInstanceOf(Candidate);
      expect(result?.firstName).toBe('Juan');
    });

    it('should return null when candidate not found', async () => {
      mockPrisma.candidate.findUnique.mockResolvedValue(null);

      const result = await Candidate.findOne(999);

      expect(result).toBeNull();
    });
  });
});

describe('Education Model Tests', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      education: {
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    (PrismaClient as jest.Mock).mockImplementation(() => mockPrisma);
  });

  describe('Education constructor', () => {
    it('should create education instance with valid data', () => {
      const educationData = {
        institution: 'Universidad de Madrid',
        title: 'Ingeniero Informático',
        startDate: '2018-09-01',
        endDate: '2022-06-30',
        candidateId: 1
      };

      const education = new Education(educationData);

      expect(education.institution).toBe('Universidad de Madrid');
      expect(education.title).toBe('Ingeniero Informático');
      expect(education.startDate).toBeInstanceOf(Date);
      expect(education.endDate).toBeInstanceOf(Date);
      expect(education.candidateId).toBe(1);
    });

    it('should handle optional end date', () => {
      const educationData = {
        institution: 'Universidad de Madrid',
        title: 'Ingeniero Informático',
        startDate: '2018-09-01'
      };

      const education = new Education(educationData);

      expect(education.endDate).toBeUndefined();
    });
  });

  describe('Education save method', () => {
    it('should create new education successfully', async () => {
      const educationData = {
        institution: 'Universidad de Madrid',
        title: 'Ingeniero Informático',
        startDate: '2018-09-01',
        candidateId: 1
      };

      const expectedResult = { id: 1, ...educationData };
      mockPrisma.education.create.mockResolvedValue(expectedResult);

      const education = new Education(educationData);
      const result = await education.save();

      expect(mockPrisma.education.create).toHaveBeenCalledWith({
        data: educationData
      });
      expect(result).toEqual(expectedResult);
    });

    it('should update existing education successfully', async () => {
      const educationData = {
        id: 1,
        institution: 'Universidad de Madrid',
        title: 'Ingeniero Informático',
        startDate: '2018-09-01',
        candidateId: 1
      };

      const expectedResult = { ...educationData };
      mockPrisma.education.update.mockResolvedValue(expectedResult);

      const education = new Education(educationData);
      const result = await education.save();

      expect(mockPrisma.education.update).toHaveBeenCalledWith({
        where: { id: 1 },
        data: educationData
      });
      expect(result).toEqual(expectedResult);
    });
  });
});

describe('WorkExperience Model Tests', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      workExperience: {
        create: jest.fn(),
        update: jest.fn(),
      },
    };
    (PrismaClient as jest.Mock).mockImplementation(() => mockPrisma);
  });

  describe('WorkExperience constructor', () => {
    it('should create work experience instance with valid data', () => {
      const experienceData = {
        company: 'Tech Corp',
        position: 'Software Developer',
        description: 'Desarrollo de aplicaciones web',
        startDate: '2022-01-01',
        endDate: '2023-12-31',
        candidateId: 1
      };

      const experience = new WorkExperience(experienceData);

      expect(experience.company).toBe('Tech Corp');
      expect(experience.position).toBe('Software Developer');
      expect(experience.description).toBe('Desarrollo de aplicaciones web');
      expect(experience.startDate).toBeInstanceOf(Date);
      expect(experience.endDate).toBeInstanceOf(Date);
      expect(experience.candidateId).toBe(1);
    });
  });

  describe('WorkExperience save method', () => {
    it('should create new work experience successfully', async () => {
      const experienceData = {
        company: 'Tech Corp',
        position: 'Software Developer',
        startDate: '2022-01-01',
        candidateId: 1
      };

      const expectedResult = { id: 1, ...experienceData };
      mockPrisma.workExperience.create.mockResolvedValue(expectedResult);

      const experience = new WorkExperience(experienceData);
      const result = await experience.save();

      expect(mockPrisma.workExperience.create).toHaveBeenCalledWith({
        data: experienceData
      });
      expect(result).toEqual(expectedResult);
    });
  });
});

describe('Resume Model Tests', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      resume: {
        create: jest.fn(),
      },
    };
    (PrismaClient as jest.Mock).mockImplementation(() => mockPrisma);
  });

  describe('Resume constructor', () => {
    it('should create resume instance with valid data', () => {
      const resumeData = {
        candidateId: 1,
        filePath: '/uploads/cv.pdf',
        fileType: 'application/pdf'
      };

      const resume = new Resume(resumeData);

      expect(resume.candidateId).toBe(1);
      expect(resume.filePath).toBe('/uploads/cv.pdf');
      expect(resume.fileType).toBe('application/pdf');
      expect(resume.uploadDate).toBeInstanceOf(Date);
    });
  });

  describe('Resume save method', () => {
    it('should create new resume successfully', async () => {
      const resumeData = {
        candidateId: 1,
        filePath: '/uploads/cv.pdf',
        fileType: 'application/pdf'
      };

      const expectedResult = { id: 1, ...resumeData, uploadDate: new Date() };
      mockPrisma.resume.create.mockResolvedValue(expectedResult);

      const resume = new Resume(resumeData);
      const result = await resume.save();

      expect(mockPrisma.resume.create).toHaveBeenCalledWith({
        data: {
          candidateId: 1,
          filePath: '/uploads/cv.pdf',
          fileType: 'application/pdf',
          uploadDate: expect.any(Date)
        }
      });
      expect(result).toBeInstanceOf(Resume);
    });

    it('should throw error when trying to update existing resume', async () => {
      const resumeData = {
        id: 1,
        candidateId: 1,
        filePath: '/uploads/cv.pdf',
        fileType: 'application/pdf'
      };

      const resume = new Resume(resumeData);

      await expect(resume.save()).rejects.toThrow(
        'No se permite la actualización de un currículum existente.'
      );
    });
  });
});

describe('Candidate Service Tests', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      candidate: {
        create: jest.fn(),
      },
    };
    (PrismaClient as jest.Mock).mockImplementation(() => mockPrisma);
  });

  describe('addCandidate', () => {
    it('should add candidate successfully with basic data', async () => {
      const candidateData = {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@email.com'
      };

      const expectedResult = { id: 1, ...candidateData };
      mockPrisma.candidate.create.mockResolvedValue(expectedResult);

      const result = await addCandidate(candidateData);

      expect(result).toEqual(expectedResult);
    });

    it('should add candidate with education data', async () => {
      const candidateData = {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@email.com',
        educations: [{
          institution: 'Universidad de Madrid',
          title: 'Ingeniero Informático',
          startDate: '2018-09-01'
        }]
      };

      const expectedResult = { id: 1, ...candidateData };
      mockPrisma.candidate.create.mockResolvedValue(expectedResult);

      const result = await addCandidate(candidateData);

      expect(result).toEqual(expectedResult);
    });

    it('should add candidate with work experience data', async () => {
      const candidateData = {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@email.com',
        workExperiences: [{
          company: 'Tech Corp',
          position: 'Software Developer',
          startDate: '2022-01-01'
        }]
      };

      const expectedResult = { id: 1, ...candidateData };
      mockPrisma.candidate.create.mockResolvedValue(expectedResult);

      const result = await addCandidate(candidateData);

      expect(result).toEqual(expectedResult);
    });

    it('should add candidate with CV data', async () => {
      const candidateData = {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@email.com',
        cv: {
          filePath: '/uploads/cv.pdf',
          fileType: 'application/pdf'
        }
      };

      const expectedResult = { id: 1, ...candidateData };
      mockPrisma.candidate.create.mockResolvedValue(expectedResult);

      const result = await addCandidate(candidateData);

      expect(result).toEqual(expectedResult);
    });

    it('should throw error for invalid candidate data', async () => {
      const invalidData = {
        firstName: '', // Invalid
        lastName: 'Pérez',
        email: 'juan.perez@email.com'
      };

      await expect(addCandidate(invalidData)).rejects.toThrow('Invalid name');
    });

    it('should handle duplicate email error', async () => {
      const candidateData = {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@email.com'
      };

      const duplicateError = new Error('Duplicate email');
      (duplicateError as any).code = 'P2002';
      mockPrisma.candidate.create.mockRejectedValue(duplicateError);

      await expect(addCandidate(candidateData)).rejects.toThrow(
        'The email already exists in the database'
      );
    });
  });
});

describe('Candidate Controller Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    mockRequest = {
      body: {}
    };
    mockResponse = {
      status: mockStatus,
      json: mockJson
    };
  });

  describe('addCandidateController', () => {
    it('should add candidate successfully', async () => {
      const candidateData = {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@email.com'
      };

      mockRequest.body = candidateData;

      await addCandidateController(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(201);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Candidate added successfully',
        data: expect.any(Object)
      });
    });

    it('should handle validation error', async () => {
      const invalidData = {
        firstName: '', // Invalid
        lastName: 'Pérez',
        email: 'juan.perez@email.com'
      };

      mockRequest.body = invalidData;

      await addCandidateController(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Error adding candidate',
        error: 'Invalid name'
      });
    });

    it('should handle unknown error', async () => {
      const candidateData = {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@email.com'
      };

      mockRequest.body = candidateData;

      // Mock the service to throw a non-Error object
      jest.spyOn(require('../application/services/candidateService'), 'addCandidate')
        .mockRejectedValue('Unknown error');

      await addCandidateController(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        message: 'Error adding candidate',
        error: 'Unknown error'
      });
    });
  });
});

describe('File Upload Service Tests', () => {
  let mockRequest: Partial<Request>;
  let mockResponse: Partial<Response>;
  let mockJson: jest.Mock;
  let mockStatus: jest.Mock;

  beforeEach(() => {
    mockJson = jest.fn();
    mockStatus = jest.fn().mockReturnValue({ json: mockJson });
    mockRequest = {
      body: {},
      file: undefined
    };
    mockResponse = {
      status: mockStatus,
      json: mockJson
    };
  });

  describe('uploadFile', () => {
    it('should upload file successfully', () => {
      mockRequest.file = {
        path: '/uploads/test-file.pdf',
        mimetype: 'application/pdf',
        originalname: 'test-file.pdf'
      } as Express.Multer.File;

      uploadFile(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(200);
      expect(mockJson).toHaveBeenCalledWith({
        filePath: '/uploads/test-file.pdf',
        fileType: 'application/pdf'
      });
    });

    it('should handle missing file error', () => {
      mockRequest.file = undefined;

      uploadFile(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(400);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Invalid file type, only PDF and DOCX are allowed!'
      });
    });

    it('should handle multer error', () => {
      const multerError = new Error('Multer error');
      (multerError as any).code = 'LIMIT_FILE_SIZE';

      mockRequest.body = { error: 'Multer error' };

      uploadFile(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'Multer error'
      });
    });

    it('should handle general error', () => {
      mockRequest.body = { error: 'General error' };

      uploadFile(mockRequest as Request, mockResponse as Response);

      expect(mockStatus).toHaveBeenCalledWith(500);
      expect(mockJson).toHaveBeenCalledWith({
        error: 'General error'
      });
    });
  });
});

// Tests de integración para validar el flujo completo
describe('Integration Tests', () => {
  let mockPrisma: any;

  beforeEach(() => {
    mockPrisma = {
      candidate: {
        create: jest.fn(),
        findUnique: jest.fn(),
      },
      education: {
        create: jest.fn(),
      },
      workExperience: {
        create: jest.fn(),
      },
      resume: {
        create: jest.fn(),
      },
    };
    (PrismaClient as jest.Mock).mockImplementation(() => mockPrisma);
  });

  describe('Complete candidate creation flow', () => {
    it('should create candidate with all related data', async () => {
      const candidateData = {
        firstName: 'María',
        lastName: 'García',
        email: 'maria.garcia@email.com',
        phone: '612345678',
        address: 'Calle Principal 456',
        educations: [{
          institution: 'Universidad de Barcelona',
          title: 'Ingeniera de Software',
          startDate: '2019-09-01',
          endDate: '2023-06-30'
        }],
        workExperiences: [{
          company: 'Innovation Labs',
          position: 'Senior Developer',
          description: 'Desarrollo de aplicaciones móviles',
          startDate: '2023-07-01'
        }],
        cv: {
          filePath: '/uploads/maria-cv.pdf',
          fileType: 'application/pdf'
        }
      };

      const expectedCandidate = { id: 1, ...candidateData };
      mockPrisma.candidate.create.mockResolvedValue(expectedCandidate);

      const result = await addCandidate(candidateData);

      expect(result).toEqual(expectedCandidate);
      expect(mockPrisma.candidate.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          firstName: 'María',
          lastName: 'García',
          email: 'maria.garcia@email.com',
          educations: {
            create: [{
              institution: 'Universidad de Barcelona',
              title: 'Ingeniera de Software',
              startDate: '2019-09-01',
              endDate: '2023-06-30'
            }]
          },
          workExperiences: {
            create: [{
              company: 'Innovation Labs',
              position: 'Senior Developer',
              description: 'Desarrollo de aplicaciones móviles',
              startDate: '2023-07-01'
            }]
          },
          resumes: {
            create: [{
              filePath: '/uploads/maria-cv.pdf',
              fileType: 'application/pdf'
            }]
          }
        })
      });
    });
  });
});

// Tests de edge cases y casos límite
describe('Edge Cases Tests', () => {
  describe('Validator edge cases', () => {
    it('should handle very long names at boundary', () => {
      const longName = 'a'.repeat(100); // Exactly at the limit
      const validData = {
        firstName: longName,
        lastName: 'Pérez',
        email: 'juan.perez@email.com'
      };

      expect(() => validateCandidateData(validData)).not.toThrow();
    });

    it('should reject names exceeding limit', () => {
      const tooLongName = 'a'.repeat(101); // Exceeds limit
      const invalidData = {
        firstName: tooLongName,
        lastName: 'Pérez',
        email: 'juan.perez@email.com'
      };

      expect(() => validateCandidateData(invalidData)).toThrow('Invalid name');
    });

    it('should handle special characters in names', () => {
      const validData = {
        firstName: 'Jose Maria',
        lastName: 'Garcia-Lopez',
        email: 'jose.maria@email.com'
      };

      expect(() => validateCandidateData(validData)).not.toThrow();
    });

    it('should handle international email addresses', () => {
      const validData = {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez+test@subdomain.example.co.uk'
      };

      expect(() => validateCandidateData(validData)).not.toThrow();
    });
  });

  describe('Date validation edge cases', () => {
    it('should handle leap year dates', () => {
      const validData = {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@email.com',
        educations: [{
          institution: 'Universidad',
          title: 'Título',
          startDate: '2020-02-29' // Leap year
        }]
      };

      expect(() => validateCandidateData(validData)).not.toThrow();
    });

    it('should reject invalid date format', () => {
      const invalidData = {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@email.com',
        educations: [{
          institution: 'Universidad',
          title: 'Título',
          startDate: '2020/13/01' // Invalid format (should be YYYY-MM-DD)
        }]
      };

      expect(() => validateCandidateData(invalidData)).toThrow('Invalid date');
    });
  });
});

// Tests de rendimiento y stress
describe('Performance Tests', () => {
  describe('Validator performance', () => {
    it('should handle large datasets efficiently', () => {
      const largeEducationArray = Array(100).fill(null).map((_, index) => ({
        institution: `Universidad ${index}`,
        title: `Título ${index}`,
        startDate: '2020-01-01'
      }));

      const largeWorkExperienceArray = Array(100).fill(null).map((_, index) => ({
        company: `Empresa ${index}`,
        position: `Posición ${index}`,
        startDate: '2020-01-01'
      }));

      const largeData = {
        firstName: 'Juan',
        lastName: 'Pérez',
        email: 'juan.perez@email.com',
        educations: largeEducationArray,
        workExperiences: largeWorkExperienceArray
      };

      const startTime = Date.now();
      expect(() => validateCandidateData(largeData)).not.toThrow();
      const endTime = Date.now();

      // Should complete validation in less than 100ms
      expect(endTime - startTime).toBeLessThan(100);
    });
  });
}); 