import { defineType, defineField } from "sanity";

const post = defineType({
  name: "post",
  title: "Blog Post",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Title", type: "string", validation: (r) => r.required() }),
    defineField({
      name: "slug",
      title: "Slug",
      type: "slug",
      options: { source: "title", maxLength: 96 },
      validation: (r) => r.required(),
    }),
    defineField({ name: "excerpt", title: "Excerpt", type: "text", rows: 3, validation: (r) => r.required() }),
    defineField({ name: "publishedAt", title: "Published At", type: "datetime", validation: (r) => r.required() }),
    defineField({
      name: "category",
      title: "Category",
      type: "string",
      options: {
        list: [
          { title: "Strategy", value: "Strategy" },
          { title: "Platform Guides", value: "Platform Guides" },
          { title: "Market Analysis", value: "Market Analysis" },
          { title: "Fading", value: "Fading" },
          { title: "Beginner Tips", value: "Beginner Tips" },
        ],
      },
    }),
    defineField({ name: "readTime", title: "Read Time (minutes)", type: "number" }),
    defineField({
      name: "section",
      title: "Section",
      type: "string",
      options: {
        list: [
          { title: "Market Report", value: "market-report" },
          { title: "Playbook", value: "playbook" },
        ],
      },
    }),
    defineField({ name: "mainImage", title: "Main Image", type: "image", options: { hotspot: true } }),
    defineField({
      name: "body",
      title: "Body",
      type: "array",
      of: [
        { type: "block" },
        { type: "image", options: { hotspot: true } },
      ],
    }),
  ],
  preview: {
    select: { title: "title", subtitle: "publishedAt", media: "mainImage" },
  },
});

export const schemaTypes = [post];
