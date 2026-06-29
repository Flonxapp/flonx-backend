import { PipelineStage, Model } from 'mongoose';

class QueryBuilder2<T> {
  public query: Record<string, unknown>;
  public pipeline: PipelineStage[];
  public model: Model<T>;

  constructor(model: Model<T>, query: Record<string, unknown>) {
    this.query = query;
    this.pipeline = [];
    this.model = model;
  }

  search(searchableFields: string[]) {
    const searchTerm = this?.query?.search as string;
    if (searchTerm) {
      this.pipeline.push({
        $match: {
          $or: searchableFields.map((field) => ({
            [field]: { $regex: searchTerm, $options: 'i' },
          })),
        },
      });
    }
    return this;
  }

  filter() {
    const queryObj = { ...this.query };
    const excludeFields = ['search', 'sort', 'limit', 'page', 'fields'];
    excludeFields.forEach((el) => delete queryObj[el]);

    if (Object.keys(queryObj).length) {
      this.pipeline.push({ $match: queryObj });
    }
    return this;
  }

  sort() {
    const sortField = this.query.sort as string;
    if (sortField) {
      const order = sortField.startsWith('-') ? -1 : 1;
      const fieldName = sortField.replace('-', '');
      this.pipeline.push({ $sort: { [fieldName]: order } });
    } else {
      this.pipeline.push({ $sort: { createdAt: -1 } });
    }
    return this;
  }

  paginate() {
    const page = Number(this?.query.page) || 1;
    const limit = Math.min(Number(this?.query.limit) || 10, 50);
    const skip = (page - 1) * limit;
    this.pipeline.push({ $skip: skip }, { $limit: limit });
    return this;
  }

  project(fields: string[] = []) {
    const projection: Record<string, number> = {};
    if (fields.length) {
      fields.forEach((field) => (projection[field] = 1));
    } else {
      projection['-_v'] = 0;
    }
    this.pipeline.push({ $project: projection });
    return this;
  }

  countTotal() {
    this.pipeline.push({
      $facet: {
        data: [{ $skip: 0 }, { $limit: 10 }],
        meta: [{ $count: 'total' }],
      },
    });
    this.pipeline.push({
      $project: {
        data: 1,
        total: { $ifNull: [{ $arrayElemAt: ['$meta.total', 0] }, 0] },
      },
    });
    return this;
  }

  async execute() {
    return await this.model.aggregate(this.pipeline);
  }
}

export default QueryBuilder2;
