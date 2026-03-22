import mongoose, { Document, Schema } from 'mongoose';
import { CommentSeverity } from '../types';

// ─── Interfaces ──────────────────────────────────────────────────────────────

export interface IReviewComment {
  path: string;
  line: number;
  severity: CommentSeverity;
  comment: string;
  suggestion: string | null;
}

// NOTE: We do NOT put 'model' here — Mongoose's Document already has a 'model'
// property with an incompatible type. We use 'aiModel' instead.
export interface IReview extends Document {
  // Repo
  repoFullName: string;
  owner: string;
  repo: string;
  // PR
  prNumber: number;
  prTitle: string;
  prAuthor: string;
  prAuthorAvatar: string;
  prUrl: string;
  headBranch: string;
  baseBranch: string;
  additions: number;
  deletions: number;
  changedFiles: number;
  // AI results
  score: number;
  summary: string;
  positives: string[];
  comments: IReviewComment[];
  // Metadata
  processingMs: number;
  aiModel: string;         // renamed from 'model' — avoids clash with Document.model()
  tokensUsed?: number;
  githubReviewId?: string;
  deliveryId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed' | 'skipped';
  errorMessage?: string;
  // Timestamps (from mongoose)
  createdAt: Date;
  updatedAt: Date;
  // Virtual
  issueCount: { errors: number; warnings: number; suggestions: number; total: number };
}

// ─── Schemas ─────────────────────────────────────────────────────────────────

const CommentSchema = new Schema<IReviewComment>(
  {
    path: { type: String, required: true },
    line: { type: Number, required: true },
    severity: { type: String, enum: ['error', 'warning', 'suggestion'], default: 'suggestion' },
    comment: { type: String, required: true },
    suggestion: { type: String, default: null },
  },
  { _id: false }
);

const ReviewSchema = new Schema<IReview>(
  {
    repoFullName: { type: String, required: true, index: true },
    owner: { type: String, required: true },
    repo: { type: String, required: true },

    prNumber: { type: Number, required: true },
    prTitle: { type: String, required: true },
    prAuthor: { type: String, required: true },
    prAuthorAvatar: { type: String, default: '' },
    prUrl: { type: String, default: '' },
    headBranch: { type: String, default: '' },
    baseBranch: { type: String, default: '' },
    additions: { type: Number, default: 0 },
    deletions: { type: Number, default: 0 },
    changedFiles: { type: Number, default: 0 },

    score: { type: Number, min: 1, max: 10 },
    summary: { type: String, default: '' },
    positives: [{ type: String }],
    comments: [CommentSchema],

    processingMs: { type: Number, default: 0 },
    aiModel: { type: String, default: '' },
    tokensUsed: { type: Number },
    githubReviewId: { type: String },
    deliveryId: { type: String, unique: true, sparse: true },

    status: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'skipped'],
      default: 'pending',
      index: true,
    },
    errorMessage: { type: String },
  },
  {
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true },
  }
);

// Compound indexes for efficient queries
ReviewSchema.index({ repoFullName: 1, prNumber: 1 });
ReviewSchema.index({ createdAt: -1 });

// Virtual: breakdowns of comment severity counts
ReviewSchema.virtual('issueCount').get(function (this: IReview) {
  return {
    errors: this.comments.filter((c) => c.severity === 'error').length,
    warnings: this.comments.filter((c) => c.severity === 'warning').length,
    suggestions: this.comments.filter((c) => c.severity === 'suggestion').length,
    total: this.comments.length,
  };
});

export const Review = mongoose.model<IReview>('Review', ReviewSchema);