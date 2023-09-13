import WebsiteRecordModel from '$db/models/WebsiteRecordModel';
import type { WebsiteRecord } from '$lib/types';
import { json, error } from '@sveltejs/kit';

export async function GET({ params }) {
	const websiteRecordModel = new WebsiteRecordModel();
	const data = await websiteRecordModel.getByID(params.id);

    if(!data) {
        throw error(404, 'No record with this ID found');
    }

	return json(
        {
            id: data.id?.toString(),
            url: data.url,
            periodicity: {
                unit: data.periodicity.unit,
                interval: data.periodicity.interval
            },
            regexp: data.regexp,
            label: data.label,
            active: data.active,
            tags: data.tags
        }
	);
}

export async function PUT({ params, request }) {
    const websiteRecordModel = new WebsiteRecordModel();
    const record  = await request.json();
    const updatedRecord = await websiteRecordModel.update(params.id, record as WebsiteRecord);

    if(!updatedRecord) {
        throw error(404, 'No record with this ID found');
    }

    return json(
        {
            id: updatedRecord.id?.toString(),
            url: updatedRecord.url,
            periodicity: {
                unit: updatedRecord.periodicity.unit,
                interval: updatedRecord.periodicity.interval
            },
            regexp: updatedRecord.regexp,
            label: updatedRecord.label,
            active: updatedRecord.active,
            tags: updatedRecord.tags
        }
    );
}

export async function DELETE({ params }) {
    const websiteRecordModel = new WebsiteRecordModel();
    const result = await websiteRecordModel.delete(params.id);

    if(!result) {
        throw error(404, 'No record with this ID found');
    }

    return json(
        {
            success: result
        }
    );
}