import { FilterQuery, Query } from 'mongoose';
import { escapeRegex, sanitizeQueryObject } from './queryBuilder.utils';

class QueryBuilder<T> {
  public modelQuery: Query<T[], T>;
  public query: Record<string, unknown>;
  constructor(modelQuery: Query<T[], T>, query: Record<string, unknown>) {
    this.modelQuery = modelQuery;
    this.query = query;
  }
  search(searchableFields: string[]) {
    const searchTerm = this?.query?.searchTerm;
    if (searchTerm && typeof searchTerm === 'string') {
      const safeSearchTerm = escapeRegex(searchTerm);
      this.modelQuery = this?.modelQuery.find({
        $or: searchableFields.map(
          (field) =>
            ({
              [field]: { $regex: safeSearchTerm, $options: 'i' },
            }) as FilterQuery<T>,
        ),
      });
    }
    return this;
  }
  filter() {
    const queryObj = { ...this.query }; // copy the query
    const excludeFields = ['searchTerm', 'sort', 'limit', 'page', 'fields'];
    excludeFields.forEach((el) => delete queryObj[el]);
    const sanitizedQueryObj = sanitizeQueryObject(queryObj);
    this.modelQuery = this.modelQuery.find(sanitizedQueryObj as FilterQuery<T>);
    return this;
  }
  // sort() {
  //   const sort =
  //     (this?.query?.sort as string)?.split(',')?.join(' ') || '-createdAt';
  //   this.modelQuery = this.modelQuery.sort(sort as string);
  //   return this;
  // }

  sort() {
    const sortField = this.query.sort as string;

    if (sortField && /^-?[a-zA-Z0-9_.]+$/.test(sortField)) {
      // Check if the sortField starts with '-' (indicating descending order)
      const order = sortField.startsWith('-') ? -1 : 1;
      const fieldName = sortField.replace('-', '');

      // Dynamic sorting based on any field provided in the query
      this.modelQuery = this.modelQuery.sort({
        [fieldName]: order,
      });
    } else {
      // Default sorting if no valid sort option is provided
      this.modelQuery = this.modelQuery.sort('-createdAt');
    }

    return this;
  }

  paginate() {
    const page = Number(this?.query.page) || 1;
    const limit = Number(this?.query.limit) || 10;
    const skip = (page - 1) * limit;
    this.modelQuery = this.modelQuery.skip(skip).limit(limit);
    return this;
  }
  fields() {
    const fields =
      (this?.query?.fields as string)?.split(',')?.join(' ') || '-_v';
    this.modelQuery = this.modelQuery.select(fields);
    return this;
  }
  async countTotal() {
    const totalQueries = this.modelQuery.getFilter();
    const total = await this.modelQuery.model.countDocuments(totalQueries);
    const page = Number(this?.query?.page) || 1;
    const limit = Number(this?.query?.limit) || 10;
    const totalPage = Math.ceil(total / limit);

    return {
      page,
      limit,
      total,
      totalPage,
    };
  }
}

export default QueryBuilder;
